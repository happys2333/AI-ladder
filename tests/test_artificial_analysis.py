import copy
import json
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


def page(number=1, total=1, model=None):
    return {'tier': 'free', 'intelligence_index_version': 4.1,
            'pagination': {'page': number, 'page_size': 1, 'total_pages': total, 'has_more': number < total},
            'data': [copy.deepcopy(model or FREE_MODEL)]}


class NormalizationTests(unittest.TestCase):
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

    def test_pro_sends_prompt_type(self):
        result, fetch = self.fetch([page()], aa.DEFAULT_API_URL.removesuffix('/free'))
        self.assertEqual(fetch.call_args.kwargs['params'], {'page': 1, 'prompt_type': 'medium'})
        self.assertEqual(result['promptType'], 'medium')

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


if __name__ == '__main__':
    unittest.main()
