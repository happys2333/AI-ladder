from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


DEFAULT_API_URL = 'https://artificialanalysis.ai/api/v2/data/llms/models'
DEFAULT_LLM_STATS_API_URL = 'https://api.llm-stats.com/stats/v1/models'
DEFAULT_LLM_STATS_SCORES_API_URL = 'https://api.llm-stats.com/stats/v1/scores'
DEFAULT_OUTPUT = Path('public/data/artificial-analysis-llms.json')
DEFAULT_MODEL_LIMIT = 700
ROOT_DIR = Path(__file__).resolve().parents[2]

SOURCE_INFO = {
    'id': 'artificial-analysis-llms',
    'label': 'Artificial Analysis + LLM Stats',
    'url': 'https://artificialanalysis.ai/api-reference',
}

CATEGORIES = [
    {'key': 'overall', 'label': '智能指数'},
    {'key': 'coding', 'label': '代码'},
    {'key': 'reasoning', 'label': '推理'},
    {'key': 'price', 'label': '价格'},
    {'key': 'speed', 'label': '速度'},
]

CN_CREATOR_KEYWORDS = (
    'alibaba', 'deepseek', 'minimax', 'kimi', 'moonshot', 'z.ai', 'z ai', 'zai', 'zhipu', 'baidu',
    'tencent', 'xiaomi', '01.ai', 'stepfun', 'hailuo', 'doubao', 'bytedance',
)

OPEN_WEIGHT_KEYWORDS = ('open-weight', 'open weights', 'open source', 'open-weights')
PROPRIETARY_KEYWORDS = ('closed', 'proprietary', 'api-only')
OPEN_WEIGHT_CREATORS = ('meta', 'deepseek', 'mistral', 'alibaba', 'qwen', 'z.ai')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate Artificial Analysis leaderboard JSON')
    parser.add_argument('--api-key', default=os.getenv('ARTIFICIAL_ANALYSIS_API_KEY', ''), help='Artificial Analysis API key')
    parser.add_argument('--api-url', default=os.getenv('ARTIFICIAL_ANALYSIS_API_URL', DEFAULT_API_URL), help='Artificial Analysis API URL')
    parser.add_argument('--llm-stats-key', default=os.getenv('LLM_STATS_KEY', ''), help='LLM Stats API key')
    parser.add_argument('--llm-stats-api-url', default=os.getenv('LLM_STATS_API_URL', DEFAULT_LLM_STATS_API_URL), help='LLM Stats models API URL')
    parser.add_argument(
        '--llm-stats-scores-api-url',
        default=os.getenv('LLM_STATS_SCORES_API_URL', DEFAULT_LLM_STATS_SCORES_API_URL),
        help='LLM Stats scores API URL',
    )
    parser.add_argument(
        '--llm-stats-verified-only',
        action='store_true',
        default=os.getenv('LLM_STATS_VERIFIED_ONLY', '').strip().lower() in {'1', 'true', 'yes', 'on'},
        help='Only keep verified LLM Stats benchmark scores',
    )
    parser.add_argument('--output', default=os.getenv('ARTIFICIAL_ANALYSIS_OUTPUT', str(DEFAULT_OUTPUT)), help='Output JSON path')
    parser.add_argument(
        '--prompt-length',
        default=os.getenv('ARTIFICIAL_ANALYSIS_PROMPT_LENGTH', 'medium'),
        choices=['short', 'medium', 'long'],
        help='Prompt length option passed to the API',
    )
    parser.add_argument(
        '--parallel-queries',
        default=int(os.getenv('ARTIFICIAL_ANALYSIS_PARALLEL_QUERIES', '1')),
        type=int,
        help='Parallel queries option passed to the API',
    )
    parser.add_argument(
        '--model-limit',
        default=int(os.getenv('ARTIFICIAL_ANALYSIS_MODEL_LIMIT', str(DEFAULT_MODEL_LIMIT))),
        type=int,
        help='Maximum number of ranked models to keep in generated JSON',
    )
    return parser.parse_args()


def require_api_key(api_key: str) -> str:
    api_key = api_key.strip()
    if api_key:
        return api_key

    raise RuntimeError(
        'Missing Artificial Analysis API key. Set ARTIFICIAL_ANALYSIS_API_KEY or pass --api-key.'
    )


def require_llm_stats_key(api_key: str) -> str:
    api_key = api_key.strip()
    if api_key:
        return api_key

    raise RuntimeError(
        'Missing LLM Stats API key. Set LLM_STATS_KEY or pass --llm-stats-key.'
    )


def fetch_models(api_url: str, api_key: str, prompt_length: str, parallel_queries: int) -> dict[str, Any]:
    session = requests.Session()
    session.trust_env = False
    response = session.get(
        api_url,
        headers={'x-api-key': api_key},
        params={
            'prompt_length': prompt_length,
            'parallel_queries': parallel_queries,
        },
        timeout=60,
    )
    response.raise_for_status()
    return response.json()


def fetch_llm_stats_models(api_url: str, api_key: str) -> list[dict[str, Any]]:
    session = requests.Session()
    session.trust_env = False
    headers = {'Authorization': f'Bearer {api_key}'}
    models: list[dict[str, Any]] = []
    cursor: str | None = None

    while True:
        params: dict[str, Any] = {'limit': 200}
        if cursor:
            params['cursor'] = cursor

        response = session.get(api_url, headers=headers, params=params, timeout=60)
        response.raise_for_status()
        payload = response.json()

        models.extend(payload.get('models', []) or [])
        cursor = payload.get('next_cursor')
        if not cursor:
            break

    return models


def fetch_llm_stats_scores(api_url: str, api_key: str, verified_only: bool) -> list[dict[str, Any]]:
    session = requests.Session()
    session.trust_env = False
    headers = {'Authorization': f'Bearer {api_key}'}
    scores: list[dict[str, Any]] = []
    cursor: str | None = None

    while True:
        params: dict[str, Any] = {'limit': 500}
        if cursor:
            params['cursor'] = cursor
        if verified_only:
            params['verified'] = 'true'

        response = session.get(api_url, headers=headers, params=params, timeout=60)
        response.raise_for_status()
        payload = response.json()

        page_scores = payload.get('scores')
        if page_scores is None:
            page_scores = payload.get('data')

        if isinstance(page_scores, list):
            scores.extend(page_scores)

        cursor = payload.get('next_cursor')
        if not cursor:
            break

    return scores


def normalize_number(value: Any, multiplier: float = 1.0) -> float:
    if value is None:
        return 0.0

    try:
        return round(float(value) * multiplier, 2)
    except (TypeError, ValueError):
        return 0.0


def normalize_text(value: Any) -> str:
    if value is None:
        return ''

    if isinstance(value, str):
        return value.strip().lower()

    if isinstance(value, bool):
        return 'true' if value else 'false'

    if isinstance(value, (int, float)):
        return str(value).strip().lower()

    if isinstance(value, dict):
        parts = []
        for nested_key in ('value', 'label', 'name', 'slug', 'type', 'category', 'description'):
            nested_value = normalize_text(value.get(nested_key))
            if nested_value:
                parts.append(nested_value)
        return ' '.join(parts)

    if isinstance(value, (list, tuple, set)):
        return ' '.join(filter(None, (normalize_text(item) for item in value)))

    return str(value).strip().lower()


def normalize_lookup_key(value: Any) -> str:
    text = normalize_text(value)
    if not text:
        return ''

    normalized = []
    last_was_space = False
    for character in text:
        if character.isalnum():
            normalized.append(character)
            last_was_space = False
            continue

        if not last_was_space:
            normalized.append(' ')
            last_was_space = True

    collapsed = ''.join(normalized).strip()
    return ' '.join(collapsed.split())


def strip_parenthetical(value: str) -> str:
    text = value.strip()
    while '(' in text and ')' in text:
        start = text.rfind('(')
        end = text.find(')', start)
        if start == -1 or end == -1:
            break
        text = f"{text[:start].strip()} {text[end + 1:].strip()}".strip()
    return ' '.join(text.split())


def slugify_benchmark_key(value: Any) -> str:
    text = normalize_lookup_key(value)
    return text.replace(' ', '-') if text else ''


def build_llm_stats_index(models: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}

    for model in models:
        candidates = {
            normalize_lookup_key(model.get('id')),
            normalize_lookup_key(model.get('name')),
            normalize_lookup_key(model.get('url')),
            normalize_lookup_key(strip_parenthetical(str(model.get('name') or ''))),
        }

        for candidate in filter(None, candidates):
            index.setdefault(candidate, model)

    return index


def aggregate_llm_stats_scores(scores: list[dict[str, Any]], verified_only: bool) -> dict[str, dict[str, dict[str, Any]]]:
    scores_by_model: dict[str, dict[str, dict[str, Any]]] = {}

    for entry in scores:
        model_id = normalize_text(entry.get('model_id'))
        if not model_id:
            continue

        verified = entry.get('verified')
        if verified_only and verified is not True:
            continue

        benchmark_key = (
            slugify_benchmark_key(entry.get('benchmark_id'))
            or slugify_benchmark_key(entry.get('benchmark_name'))
            or slugify_benchmark_key(entry.get('benchmark'))
        )
        if not benchmark_key:
            continue

        benchmark_payload = {
            'benchmarkId': entry.get('benchmark_id'),
            'benchmarkName': entry.get('benchmark_name') or entry.get('benchmark'),
            'score': entry.get('score'),
            'normalizedScore': entry.get('normalized_score') if entry.get('normalized_score') is not None else entry.get('score'),
            'verified': verified,
            'scoredAt': entry.get('scored_at'),
            'source': entry.get('source'),
        }

        existing = scores_by_model.setdefault(model_id, {}).get(benchmark_key)
        if existing is None:
            scores_by_model[model_id][benchmark_key] = benchmark_payload
            continue

        existing_verified = existing.get('verified') is True
        candidate_verified = benchmark_payload.get('verified') is True
        existing_scored_at = normalize_text(existing.get('scoredAt'))
        candidate_scored_at = normalize_text(benchmark_payload.get('scoredAt'))

        should_replace = False
        if candidate_verified and not existing_verified:
            should_replace = True
        elif candidate_verified == existing_verified and candidate_scored_at > existing_scored_at:
            should_replace = True

        if should_replace:
            scores_by_model[model_id][benchmark_key] = benchmark_payload

    return scores_by_model


def match_llm_stats_model(model: dict[str, Any], llm_stats_index: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    aa_slug = (model.get('slug') or '').replace('-', ' ').replace('_', ' ')
    aa_name = model.get('name') or ''
    candidates = [
        normalize_lookup_key(aa_slug),
        normalize_lookup_key(aa_name),
        normalize_lookup_key(strip_parenthetical(str(aa_name))),
    ]

    for candidate in candidates:
        if candidate and candidate in llm_stats_index:
            return llm_stats_index[candidate]

    return None


def detect_region(model: dict[str, Any]) -> str:
    creator_name = (model.get('model_creator', {}) or {}).get('name', '')
    name = model.get('name', '')
    haystack = f'{creator_name} {name}'.lower()
    return 'cn' if any(keyword in haystack for keyword in CN_CREATOR_KEYWORDS) else 'global'


def detect_openness(model: dict[str, Any]) -> str:
    direct_candidates = [
        model.get('openness'),
        model.get('open_weights'),
        model.get('open_source_categorization'),
        model.get('open_source'),
        model.get('weights_available'),
        model.get('weights_access'),
        model.get('weights_type'),
        model.get('model_access'),
        (model.get('metadata') or {}).get('open_weights'),
        (model.get('metadata') or {}).get('open_source_categorization'),
    ]

    for candidate in direct_candidates:
        if isinstance(candidate, bool):
            return 'open' if candidate else 'other'

        normalized = normalize_text(candidate)
        if not normalized:
            continue

        if normalized in {'true', '1'}:
            return 'open'
        if normalized in {'false', '0'}:
            return 'other'
        if any(keyword in normalized for keyword in OPEN_WEIGHT_KEYWORDS) or 'commercial use restricted' in normalized:
            return 'open'
        if any(keyword in normalized for keyword in PROPRIETARY_KEYWORDS):
            return 'other'

    name = model.get('name', '').lower()
    slug = model.get('slug', '').lower()
    creator = ((model.get('model_creator', {}) or {}).get('name') or '').lower()
    haystack = f'{name} {slug} {creator}'

    if any(keyword in haystack for keyword in OPEN_WEIGHT_KEYWORDS):
        return 'open'

    if any(keyword in haystack for keyword in OPEN_WEIGHT_CREATORS):
        return 'open'

    return 'other'


def build_tags(model: dict[str, Any]) -> list[str]:
    tags: list[str] = []
    creator = (model.get('model_creator', {}) or {}).get('name')
    if creator:
        tags.append(creator)

    if 'reasoning' in model.get('slug', '').lower() or 'reasoning' in model.get('name', '').lower():
        tags.append('Reasoning')

    evaluations = model.get('evaluations', {}) or {}
    if normalize_number(evaluations.get('artificial_analysis_coding_index')) >= 50:
        tags.append('Coding+')
    pricing = model.get('pricing', {}) or {}
    if normalize_number(pricing.get('price_1m_blended_3_to_1')) > 0:
        tags.append(f"${normalize_number(pricing.get('price_1m_blended_3_to_1'))}/1M")

    return tags[:5]


def build_summary(model: dict[str, Any]) -> str:
    evaluations = model.get('evaluations', {}) or {}
    overall = normalize_number(evaluations.get('artificial_analysis_intelligence_index'))
    speed = normalize_number(model.get('median_output_tokens_per_second'))
    return f'AA 智能指数 {overall} · 输出速度 {speed} tok/s'


def map_model(
    model: dict[str, Any],
    llm_stats_model: dict[str, Any] | None,
    llm_stats_benchmark_scores: dict[str, dict[str, Any]] | None,
    rank: int,
) -> dict[str, Any]:
    evaluations = model.get('evaluations', {}) or {}
    pricing = model.get('pricing', {}) or {}
    creator = model.get('model_creator', {}) or {}
    llm_stats_release_date = (llm_stats_model or {}).get('release_date')
    llm_stats_license = (llm_stats_model or {}).get('license') or {}
    llm_stats_scores = (llm_stats_model or {}).get('top_scores') or {}
    llm_stats_open_weight = (llm_stats_model or {}).get('open_weight')
    llm_stats_benchmark_scores = llm_stats_benchmark_scores or {}

    return {
        'id': model.get('id') or model.get('slug') or f'artificial-analysis-{rank}',
        'name': model.get('name') or model.get('slug') or f'Model {rank}',
        'fullName': model.get('name') or model.get('slug') or f'Model {rank}',
        'region': detect_region(model),
        'openness': 'open' if llm_stats_open_weight is True else 'other' if llm_stats_open_weight is False else detect_openness(model),
        'vendor': creator.get('name') or 'Unknown',
        'summary': build_summary(model),
        'tags': build_tags(model),
        'pricing': f"${normalize_number(pricing.get('price_1m_blended_3_to_1'))} / 1M blended" if pricing else 'N/A',
        'latency': f"{normalize_number(model.get('median_time_to_first_token_seconds'))}s TTFT",
        'scores': {
            'overall': normalize_number(evaluations.get('artificial_analysis_intelligence_index')),
            'coding': normalize_number(evaluations.get('artificial_analysis_coding_index')),
            'reasoning': normalize_number(evaluations.get('gpqa'), 100),
            'price': normalize_number(pricing.get('price_1m_blended_3_to_1')),
            'speed': normalize_number(model.get('median_output_tokens_per_second')),
        },
        'meta': {
            'rank': rank,
            'slug': model.get('slug', ''),
            'creatorId': creator.get('id', ''),
            'creatorSlug': creator.get('slug', ''),
            'releaseDate': llm_stats_release_date,
            'releaseYearMonth': llm_stats_release_date[:7] if isinstance(llm_stats_release_date, str) and len(llm_stats_release_date) >= 7 else None,
            'llmStatsModelId': (llm_stats_model or {}).get('id'),
            'llmStatsModelUrl': (llm_stats_model or {}).get('url'),
            'llmStatsSource': (llm_stats_model or {}).get('source'),
            'llmStatsModelType': (llm_stats_model or {}).get('model_type'),
            'llmStatsDescription': (llm_stats_model or {}).get('description'),
            'llmStatsContextWindow': (llm_stats_model or {}).get('context_window'),
            'llmStatsParamCount': (llm_stats_model or {}).get('param_count'),
            'llmStatsModalities': (llm_stats_model or {}).get('modalities') or [],
            'llmStatsTopScores': llm_stats_scores,
            'licenseName': llm_stats_license.get('name'),
            'licenseAllowCommercial': llm_stats_license.get('allow_commercial'),
            'openWeights': model.get('open_weights'),
            'openSourceCategorization': model.get('open_source_categorization'),
            'modelAccess': model.get('model_access'),
            'benchmarks': {
                'artificialAnalysisIntelligenceIndex': normalize_number(evaluations.get('artificial_analysis_intelligence_index')),
                'artificialAnalysisCodingIndex': normalize_number(evaluations.get('artificial_analysis_coding_index')),
                'artificialAnalysisMathIndex': normalize_number(evaluations.get('artificial_analysis_math_index')),
                'mmluPro': normalize_number(evaluations.get('mmlu_pro'), 100),
                'gpqa': normalize_number(evaluations.get('gpqa'), 100),
                'hle': normalize_number(evaluations.get('hle'), 100),
                'liveCodeBench': normalize_number(evaluations.get('livecodebench'), 100),
                'sciCode': normalize_number(evaluations.get('scicode'), 100),
                'math500': normalize_number(evaluations.get('math_500'), 100),
                'aime': normalize_number(evaluations.get('aime'), 100),
                'llmStats': llm_stats_benchmark_scores,
            },
            'inputPrice': normalize_number(pricing.get('price_1m_input_tokens')),
            'outputPrice': normalize_number(pricing.get('price_1m_output_tokens')),
            'blendedPrice': normalize_number(pricing.get('price_1m_blended_3_to_1')),
            'tokensPerSecond': normalize_number(model.get('median_output_tokens_per_second')),
            'timeToFirstTokenSeconds': normalize_number(model.get('median_time_to_first_token_seconds')),
            'timeToFirstAnswerTokenSeconds': normalize_number(model.get('median_time_to_first_answer_token')),
        },
    }


def build_payload(
    response_payload: dict[str, Any],
    llm_stats_models: list[dict[str, Any]],
    llm_stats_scores: list[dict[str, Any]],
    model_limit: int,
    verified_only: bool,
) -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat()
    rows = response_payload.get('data', []) or []
    sorted_rows = sorted(
        rows,
        key=lambda item: normalize_number((item.get('evaluations', {}) or {}).get('artificial_analysis_intelligence_index')),
        reverse=True,
    )

    limited_rows = sorted_rows[:model_limit]
    llm_stats_index = build_llm_stats_index(llm_stats_models)
    llm_stats_scores_by_model = aggregate_llm_stats_scores(llm_stats_scores, verified_only)
    matched_count = 0
    matched_benchmark_count = 0
    models = []
    for rank, model in enumerate(limited_rows, start=1):
        llm_stats_model = match_llm_stats_model(model, llm_stats_index)
        if llm_stats_model:
            matched_count += 1
        llm_stats_model_id = normalize_text((llm_stats_model or {}).get('id'))
        llm_stats_benchmark_scores = llm_stats_scores_by_model.get(llm_stats_model_id, {})
        if llm_stats_benchmark_scores:
            matched_benchmark_count += 1
        models.append(map_model(model, llm_stats_model, llm_stats_benchmark_scores, rank))

    prompt_options = response_payload.get('prompt_options', {}) or {}

    return {
        'source': SOURCE_INFO,
        'categories': CATEGORIES,
        'regions': [
            {'key': 'cn', 'label': '中国阵营'},
            {'key': 'global', 'label': '全球阵营'},
        ],
        'models': models,
        'lastUpdated': generated_at,
        'generatedAt': generated_at,
        'stats': {
            'totalModels': len(models),
            'sourceRows': len(rows),
            'llmStatsModels': len(llm_stats_models),
            'llmStatsScores': len(llm_stats_scores),
            'llmStatsMatchedModels': matched_count,
            'llmStatsMatchedBenchmarkModels': matched_benchmark_count,
            'llmStatsVerifiedOnly': verified_only,
            'modelLimit': model_limit,
            'promptLength': prompt_options.get('prompt_length', 'medium'),
            'parallelQueries': prompt_options.get('parallel_queries', 1),
        },
    }


def write_payload(output_path: Path, payload: dict[str, Any]) -> None:
    absolute_output = output_path if output_path.is_absolute() else ROOT_DIR / output_path
    absolute_output.parent.mkdir(parents=True, exist_ok=True)
    absolute_output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main() -> None:
    args = parse_args()
    api_key = require_api_key(args.api_key)
    llm_stats_key = require_llm_stats_key(args.llm_stats_key)
    response_payload = fetch_models(args.api_url, api_key, args.prompt_length, args.parallel_queries)
    llm_stats_models = fetch_llm_stats_models(args.llm_stats_api_url, llm_stats_key)
    llm_stats_scores = fetch_llm_stats_scores(args.llm_stats_scores_api_url, llm_stats_key, args.llm_stats_verified_only)
    payload = build_payload(
        response_payload,
        llm_stats_models,
        llm_stats_scores,
        args.model_limit,
        args.llm_stats_verified_only,
    )
    write_payload(Path(args.output), payload)
    print(f"Generated {args.output} with {payload['stats']['totalModels']} models")


if __name__ == '__main__':
    main()
