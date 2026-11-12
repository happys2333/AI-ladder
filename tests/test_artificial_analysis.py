import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from api.scripts import generate_artificial_analysis as aa


FREE_MODEL = {
    'id': 'model-1', 'name': 'Example', 'slug': 'example', 'release_date': '2026-01-01',
    'model_creator': {'id': 'creator-1', 'name': 'Moonshot AI'},
    'evaluations': {'artificial_analysis_intelligence_index': 42, 'artificial_analysis_coding_index': None},
    'pricing': {'price_1m_input_tokens': 0, 'price_1m_output_tokens': 1},
    'performance': {'median_output_tokens_per_second': 100, 'median_time_to_first_token_seconds': None,
                    'median_time_to_first_answer_token_seconds': 2.5},
}

# Headline fields from the provider's Free/Pro reference examples. Legacy values
# deliberately disagree so precedence and semantic changes cannot go unnoticed.
# https://artificialanalysis.ai/data-api/docs/reference
V3_METRICS = {
    'mean_output_tokens_per_second': 62.36,
    'mean_time_to_first_token_seconds': 3.45,
    'mean_time_to_first_answer_token_seconds': 79.11,
}


def page(number=1, total=1, model=None):
    return {'tier': 'free', 'intelligence_index_version': 4.1,
            'pagination': {'page': number, 'page_size': 1, 'total_pages': total, 'has_more': number < total},
            'data': [copy.deepcopy(model or FREE_MODEL)]}


class NormalizationTests(unittest.TestCase):
    def test_v3_means_win_everywhere_over_legacy_medians(self):
        raw = copy.deepcopy(FREE_MODEL)
        raw['performance_v3'] = V3_METRICS.copy()
        raw['median_output_tokens_per_second'] = 999
        payload = aa.build_payload(page(model=raw), [], [], 700, False)
        model = payload['models'][0]
        self.assertEqual(model['scores']['speed'], 62.36)
        self.assertEqual(model['meta']['tokensPerSecond'], 62.36)
        self.assertEqual(model['meta']['timeToFirstTokenSeconds'], 3.45)
        self.assertEqual(model['meta']['timeToFirstAnswerTokenSeconds'], 79.11)
        self.assertIn('62.36 tok/s', model['summary'])
        self.assertEqual(model['latency'], '3.45s TTFT')
        self.assertEqual(model['meta']['performanceSchema'], 'performance_v3')
        self.assertEqual(model['meta']['performanceAggregation'], 'mean')
        self.assertIsNone(model['meta']['performanceBucketDate'])
        self.assertEqual(payload['stats']['performanceSchemas'], ['performance_v3'])

    def test_v3_survives_sunset_or_removal_of_legacy_fields(self):
        for legacy in (None, {key: None for key in FREE_MODEL['performance']}):
            with self.subTest(legacy=legacy):
                raw = copy.deepcopy(FREE_MODEL)
                raw['performance'] = legacy
                raw['performance_v3'] = V3_METRICS.copy()
                payload = aa.build_payload(page(model=raw), [], [], 700, False)
                self.assertEqual(payload['models'][0]['scores']['speed'], 62.36)
                self.assertIn('speed', [c['key'] for c in payload['categories']])
        del raw['performance']
        self.assertEqual(aa.map_model(raw, None, None, 1)['scores']['speed'], 62.36)

    def test_present_null_or_empty_v3_never_revives_legacy_values(self):
        for block in (None, {}, {key: None for key in V3_METRICS}):
            with self.subTest(block=block):
                raw = copy.deepcopy(FREE_MODEL)
                raw['performance_v3'] = block
                raw['median_output_tokens_per_second'] = 999
                payload = aa.build_payload(page(model=raw), [], [], 700, False)
                model = payload['models'][0]
                for field in ('tokensPerSecond', 'timeToFirstTokenSeconds', 'timeToFirstAnswerTokenSeconds'):
                    self.assertIsNone(model['meta'][field])
                self.assertIsNone(model['scores']['speed'])
                self.assertEqual(model['latency'], 'N/A')
                self.assertNotIn('speed', [c['key'] for c in payload['categories']])
                self.assertEqual(model['meta']['performanceSchema'], 'performance_v3')

    def test_v3_missing_or_invalid_field_does_not_fall_back(self):
        raw = copy.deepcopy(FREE_MODEL)
        for value in (None, '', 'invalid', True, [], {}, float('nan'), float('inf')):
            with self.subTest(value=value):
                raw['performance_v3'] = {**V3_METRICS, 'mean_output_tokens_per_second': value}
                model = aa.map_model(raw, None, None, 1)
                self.assertIsNone(model['scores']['speed'])
                self.assertEqual(model['meta']['timeToFirstAnswerTokenSeconds'], 79.11)
        del raw['performance_v3']['mean_output_tokens_per_second']
        self.assertIsNone(aa.map_model(raw, None, None, 1)['scores']['speed'])

    def test_v3_zero_is_a_real_measurement(self):
        raw = copy.deepcopy(FREE_MODEL)
        raw['performance_v3'] = {key: 0 for key in V3_METRICS}
        payload = aa.build_payload(page(model=raw), [], [], 700, False)
        model = payload['models'][0]
        self.assertEqual(model['scores']['speed'], 0)
        self.assertEqual(model['latency'], '0.0s TTFT')
        self.assertEqual(model['meta']['timeToFirstAnswerTokenSeconds'], 0)
        self.assertIn('speed', [c['key'] for c in payload['categories']])

    def test_pro_v3_metadata_does_not_substitute_task_or_workload_metrics(self):
        raw = copy.deepcopy(FREE_MODEL)
        raw['performance_v3'] = {
            **V3_METRICS, 'time_per_task_seconds': 1907.94, 'bucket_date': '2026-10-30',
            'workloads': {'1k': {'mean_time_to_first_token_seconds': 1.96}},
        }
        payload = page(model=raw)
        payload.update(tier='pro', promptType='long')
        mapped = aa.build_payload(payload, [], [], 700, False)
        self.assertEqual(mapped['models'][0]['meta']['performanceBucketDate'], '2026-10-30')
        self.assertIsNone(mapped['stats']['promptType'])
        for key in V3_METRICS:
            del raw['performance_v3'][key]
        model = aa.map_model(raw, None, None, 1)
        self.assertIsNone(model['scores']['speed'])
        self.assertIsNone(model['meta']['timeToFirstTokenSeconds'])
        self.assertIsNone(model['meta']['timeToFirstAnswerTokenSeconds'])

    def test_malformed_v3_block_fails_validation(self):
        for block in ([], '', 'invalid', 42, False):
            with self.subTest(block=block):
                raw = copy.deepcopy(FREE_MODEL)
                raw['performance_v3'] = block
                with self.assertRaisesRegex(ValueError, 'performance_v3'):
                    aa.build_payload(page(model=raw), [], [], 700, False)

    def test_mixed_payload_retains_each_models_methodology(self):
        new, old = copy.deepcopy(FREE_MODEL), copy.deepcopy(FREE_MODEL)
        new.update(id='v3-model', performance_v3=V3_METRICS.copy())
        payload = aa.build_payload({'data': [old, new]}, [], [], 700, False)
        self.assertEqual(payload['stats']['performanceSchemas'], ['performance', 'performance_v3'])
        self.assertEqual([m['meta']['performanceAggregation'] for m in payload['models']], ['median', 'mean'])

    def test_free_nulls_and_provider_alias(self):
        payload = aa.build_payload(page(), [], [], 700, False)
        model = payload['models'][0]
        self.assertEqual(model['scores'], {'overall': 42, 'coding': None, 'reasoning': None, 'price': None, 'speed': 100})
        self.assertEqual(model['meta']['creatorSlug'], 'kimi')
        self.assertEqual(model['meta']['releaseDate'], '2026-01-01')
        self.assertEqual(model['meta']['inputPrice'], 0)
        self.assertEqual(model['meta']['timeToFirstAnswerTokenSeconds'], 2.5)
        self.assertEqual(model['latency'], 'N/A')
        self.assertEqual(model['pricing'], 'N/A')
        self.assertEqual([c['key'] for c in payload['categories']], ['overall', 'speed'])
        self.assertIsNone(payload['stats']['promptType'])
        self.assertEqual(model['meta']['performanceSchema'], 'performance')
        self.assertEqual(model['meta']['performanceAggregation'], 'median')

    def test_pro_gpqa_and_legacy_compatibility(self):
        model = copy.deepcopy(FREE_MODEL)
        model['evaluations'].update(gpqa_diamond=0.7, gpqa=0.2)
        model['pricing']['price_1m_blended_3_to_1'] = 0
        model['model_creator'] = {'name': 'Z.AI', 'country': 'cn'}
        model['licensing'] = {'is_open_weights': True}
        model['median_output_tokens_per_second'] = 99
        model['performance']['median_output_tokens_per_second'] = None
        mapped = aa.map_model(model, None, None, 1)
        self.assertEqual(mapped['scores']['reasoning'], 70)
        self.assertEqual(mapped['scores']['price'], 0)
        self.assertIsNone(mapped['scores']['speed'])
        self.assertEqual(mapped['meta']['creatorSlug'], 'zhipu')
        self.assertEqual(mapped['openness'], 'open')
        del model['performance']
        del model['evaluations']['gpqa_diamond']
        model['median_time_to_first_answer_token'] = 3
        mapped = aa.map_model(model, None, None, 1)
        self.assertEqual(mapped['scores']['speed'], 99)
        self.assertEqual(mapped['scores']['reasoning'], 20)
        self.assertEqual(mapped['meta']['timeToFirstAnswerTokenSeconds'], 3)
        self.assertEqual(mapped['meta']['performanceSchema'], 'legacy')

    def test_invalid_numbers_remain_missing(self):
        for value in (None, '', 'invalid', True, float('nan'), float('inf')):
            self.assertIsNone(aa.normalize_number(value))
        self.assertEqual(aa.normalize_number('0'), 0)
        self.assertEqual(aa.normalize_number(0.001), 0.001)

    def test_invalid_payloads_and_empty_measurements_fail(self):
        for payload in ({}, {'error': 'broken'}, {'data': []}, {'data': [{}]}):
            with self.assertRaises(ValueError):
                aa.build_payload(payload, [], [], 700, False)
        model = copy.deepcopy(FREE_MODEL)
        model['evaluations'] = {}
        with self.assertRaises(ValueError):
            aa.build_payload(page(model=model), [], [], 700, False)

    def test_zero_ranks_above_missing(self):
        zero, missing = copy.deepcopy(FREE_MODEL), copy.deepcopy(FREE_MODEL)
        zero['evaluations']['artificial_analysis_intelligence_index'] = 0
        missing['id'] = 'missing'
        missing['evaluations']['artificial_analysis_intelligence_index'] = None
        result = aa.build_payload({'data': [missing, zero]}, [], [], 700, False)
        self.assertEqual(result['models'][0]['id'], 'model-1')

    def test_atomic_write_preserves_previous_file_on_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'snapshot.json'
            target.write_text('last good')
            with patch.object(aa.os, 'replace', side_effect=OSError('disk failure')):
                with self.assertRaises(OSError):
                    aa.write_payload(target, {'models': []})
            self.assertEqual(target.read_text(), 'last good')
            self.assertEqual(list(Path(folder).iterdir()), [target])
            with self.assertRaises(ValueError):
                aa.write_payload(target, {'value': float('nan')})
            self.assertEqual(target.read_text(), 'last good')
            aa.write_payload(target, {'value': None})
            self.assertEqual(json.loads(target.read_text()), {'value': None})


class FetchTests(unittest.TestCase):
    def fetch(self, pages, url=aa.DEFAULT_API_URL):
        responses = [Mock(json=Mock(return_value=value)) for value in pages]
        with patch.object(aa, '_fetch_with_retry', side_effect=responses) as fetch:
            result = aa.fetch_models(url, 'fixture-key', 'medium')
        return result, fetch

    def test_pagination_free_params_and_version(self):
        second = copy.deepcopy(FREE_MODEL)
        second['id'] = 'model-2'
        result, fetch = self.fetch([page(1, 2), page(2, 2, second)])
        self.assertEqual(len(result['data']), 2)
        self.assertEqual(result['pagesFetched'], 2)
        self.assertIsNone(result['promptType'])
        self.assertEqual(result['intelligence_index_version'], 4.1)
        self.assertEqual([call.kwargs['params'] for call in fetch.call_args_list], [{'page': 1}, {'page': 2}])

    def test_pro_no_longer_sends_or_claims_prompt_type(self):
        pro_page = page()
        pro_page['tier'] = 'pro'
        result, fetch = self.fetch([pro_page], aa.DEFAULT_API_URL.removesuffix('/free'))
        self.assertEqual(fetch.call_args.kwargs['params'], {'page': 1})
        self.assertIsNone(result['promptType'])

    def test_old_prompt_type_option_remains_an_ignored_compatibility_argument(self):
        with patch.object(sys, 'argv', ['updater', '--prompt-type', 'medium_coding']):
            args = aa.parse_args()
        response = Mock(json=Mock(return_value=page()))
        with patch.object(aa, '_fetch_with_retry', return_value=response) as fetch:
            result = aa.fetch_models(aa.DEFAULT_API_URL.removesuffix('/free'), 'fixture-key', args.prompt_type)
        self.assertEqual(fetch.call_args.kwargs['params'], {'page': 1})
        self.assertIsNone(result['promptType'])

    def test_repeated_missing_and_inconsistent_pages_fail(self):
        invalid = page()
        invalid.pop('pagination')
        for pages in ([invalid], [page(1, 2), page(1, 2)], [page(1, 2), page(2, 2)], [page(1, 2), page(2, 3)]):
            with self.assertRaises(ValueError):
                self.fetch(pages)

    def test_second_page_failure_never_returns_partial_data(self):
        response = Mock(json=Mock(return_value=page(1, 2)))
        with patch.object(aa, '_fetch_with_retry', side_effect=[response, aa.requests.HTTPError('failed page')]):
            with self.assertRaises(aa.requests.HTTPError):
                aa.fetch_models(aa.DEFAULT_API_URL, 'fixture-key')

    def test_mixed_versions_and_short_pages_fail(self):
        second = copy.deepcopy(FREE_MODEL)
        second['id'] = 'model-2'
        changed = page(2, 2, second)
        changed['intelligence_index_version'] = 5
        short = page(1, 2)
        short['pagination']['page_size'] = 200
        for pages in ([page(1, 2), changed], [short]):
            with self.assertRaises(ValueError):
                self.fetch(pages)

    def test_auth_errors_are_not_retried(self):
        for status in (401, 403):
            session = Mock()
            response = session.get.return_value
            response.status_code = status
            response.raise_for_status.side_effect = aa.requests.HTTPError('auth')
            with patch.object(aa.time, 'sleep') as sleep:
                with self.assertRaises(aa.requests.HTTPError):
                    aa._fetch_with_retry(session, 'url', headers={}, params={})
            self.assertEqual(session.get.call_count, 1)
            sleep.assert_not_called()

    def test_transient_and_invalid_retry_after(self):
        session = Mock()
        session.get.side_effect = [Mock(status_code=503, headers={'Retry-After': 'bad'}), Mock(status_code=200)]
        with patch.object(aa.time, 'sleep') as sleep:
            aa._fetch_with_retry(session, 'url', headers={}, params={})
        sleep.assert_called_once_with(5)
        self.assertEqual(session.get.call_count, 2)

    def test_daily_quota_exhaustion_fails_without_waiting(self):
        session = Mock()
        response = session.get.return_value
        response.status_code = 429
        response.headers = {'Retry-After': '86400'}
        response.raise_for_status.side_effect = aa.requests.HTTPError('quota')
        with patch.object(aa.time, 'sleep') as sleep:
            with self.assertRaises(aa.requests.HTTPError):
                aa._fetch_with_retry(session, 'url', headers={}, params={})
        sleep.assert_not_called()


class PipelineTests(unittest.TestCase):
    def run_updater(self, output, response_payload):
        argv = ['updater', '--api-key', 'fixture-key', '--llm-stats-key', 'fixture-key',
                '--output', str(output)]
        response = Mock(json=Mock(return_value=response_payload))
        with (patch.object(sys, 'argv', argv),
              patch.object(aa, '_fetch_with_retry', return_value=response),
              patch.object(aa, 'fetch_llm_stats_models', return_value=[]),
              patch.object(aa, 'fetch_llm_stats_scores', return_value=[])):
            aa.main()

    def test_post_cutoff_response_writes_v3_snapshot(self):
        raw = copy.deepcopy(FREE_MODEL)
        raw['performance'] = {key: None for key in raw['performance']}
        raw['performance_v3'] = V3_METRICS.copy()
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'snapshot.json'
            target.write_text('last good')
            self.run_updater(target, page(model=raw))
            payload = json.loads(target.read_text())
            self.assertEqual(payload['models'][0]['scores']['speed'], 62.36)
            self.assertEqual(payload['stats']['performanceSchemas'], ['performance_v3'])
            self.assertIsNone(payload['stats']['promptType'])

    def test_malformed_v3_never_overwrites_previous_snapshot(self):
        raw = copy.deepcopy(FREE_MODEL)
        raw['performance_v3'] = []
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'snapshot.json'
            target.write_text('last good')
            with self.assertRaisesRegex(ValueError, 'performance_v3'):
                self.run_updater(target, page(model=raw))
            self.assertEqual(target.read_text(), 'last good')


if __name__ == '__main__':
    unittest.main()
