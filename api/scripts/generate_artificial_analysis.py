from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


DEFAULT_API_URL = 'https://artificialanalysis.ai/api/v2/data/llms/models'
DEFAULT_OUTPUT = Path('public/data/artificial-analysis-llms.json')
DEFAULT_MODEL_LIMIT = 500
ROOT_DIR = Path(__file__).resolve().parents[2]

SOURCE_INFO = {
    'id': 'artificial-analysis-llms',
    'label': 'Artificial Analysis LLMs',
    'url': 'https://artificialanalysis.ai/api-reference',
}

CATEGORIES = [
    {'key': 'overall', 'label': '智能指数'},
    {'key': 'coding', 'label': '代码'},
    {'key': 'math', 'label': '数学'},
    {'key': 'reasoning', 'label': '推理'},
    {'key': 'knowledge', 'label': '知识'},
    {'key': 'agentic', 'label': '代理任务'},
]

CN_CREATOR_KEYWORDS = (
    'alibaba', 'deepseek', 'minimax', 'kimi', 'moonshot', 'z.ai', 'zhipu', 'baidu',
    'tencent', 'xiaomi', '01.ai', 'stepfun', 'hailuo', 'doubao', 'bytedance',
)

OPEN_WEIGHT_KEYWORDS = ('open', 'open-weight', 'open weights', 'oss', 'open source')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Generate Artificial Analysis leaderboard JSON')
    parser.add_argument('--api-key', default=os.getenv('ARTIFICIAL_ANALYSIS_API_KEY', ''), help='Artificial Analysis API key')
    parser.add_argument('--api-url', default=os.getenv('ARTIFICIAL_ANALYSIS_API_URL', DEFAULT_API_URL), help='Artificial Analysis API URL')
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


def fetch_models(api_url: str, api_key: str, prompt_length: str, parallel_queries: int) -> dict[str, Any]:
    response = requests.get(
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


def normalize_number(value: Any, multiplier: float = 1.0) -> float:
    if value is None:
        return 0.0

    try:
        return round(float(value) * multiplier, 2)
    except (TypeError, ValueError):
        return 0.0


def detect_region(model: dict[str, Any]) -> str:
    creator_name = (model.get('model_creator', {}) or {}).get('name', '')
    name = model.get('name', '')
    haystack = f'{creator_name} {name}'.lower()
    return 'cn' if any(keyword in haystack for keyword in CN_CREATOR_KEYWORDS) else 'global'


def detect_openness(model: dict[str, Any]) -> str:
    direct_candidates = [
        model.get('openness'),
        model.get('open_weights'),
        model.get('open_source'),
        model.get('weights_available'),
        model.get('weights_access'),
        model.get('weights_type'),
        model.get('model_access'),
    ]

    for candidate in direct_candidates:
        if isinstance(candidate, bool):
            return 'open' if candidate else 'other'

        if isinstance(candidate, str):
            normalized = candidate.strip().lower()
            if not normalized:
                continue
            if any(keyword in normalized for keyword in ('open', 'open-weight', 'commercial use restricted')):
                return 'open'
            if any(keyword in normalized for keyword in ('closed', 'proprietary', 'api-only')):
                return 'other'

    name = model.get('name', '').lower()
    slug = model.get('slug', '').lower()
    creator = ((model.get('model_creator', {}) or {}).get('name') or '').lower()
    haystack = f'{name} {slug} {creator}'

    if any(keyword in haystack for keyword in OPEN_WEIGHT_KEYWORDS):
        return 'open'

    open_weight_creators = ('meta', 'deepseek', 'mistral', 'alibaba', 'qwen', 'z.ai')
    if any(keyword in haystack for keyword in open_weight_creators):
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
    if normalize_number(evaluations.get('artificial_analysis_math_index')) >= 70:
        tags.append('Math+')

    pricing = model.get('pricing', {}) or {}
    if normalize_number(pricing.get('price_1m_blended_3_to_1')) > 0:
        tags.append(f"${normalize_number(pricing.get('price_1m_blended_3_to_1'))}/1M")

    return tags[:5]


def build_summary(model: dict[str, Any]) -> str:
    evaluations = model.get('evaluations', {}) or {}
    overall = normalize_number(evaluations.get('artificial_analysis_intelligence_index'))
    speed = normalize_number(model.get('median_output_tokens_per_second'))
    return f'AA 智能指数 {overall} · 输出速度 {speed} tok/s'


def map_model(model: dict[str, Any], rank: int) -> dict[str, Any]:
    evaluations = model.get('evaluations', {}) or {}
    pricing = model.get('pricing', {}) or {}
    creator = model.get('model_creator', {}) or {}

    return {
        'id': model.get('id') or model.get('slug') or f'artificial-analysis-{rank}',
        'name': model.get('name') or model.get('slug') or f'Model {rank}',
        'fullName': model.get('name') or model.get('slug') or f'Model {rank}',
        'region': detect_region(model),
        'openness': detect_openness(model),
        'vendor': creator.get('name') or 'Unknown',
        'summary': build_summary(model),
        'tags': build_tags(model),
        'pricing': f"${normalize_number(pricing.get('price_1m_blended_3_to_1'))} / 1M blended" if pricing else 'N/A',
        'latency': f"{normalize_number(model.get('median_time_to_first_token_seconds'))}s TTFT",
        'scores': {
            'overall': normalize_number(evaluations.get('artificial_analysis_intelligence_index')),
            'coding': normalize_number(evaluations.get('artificial_analysis_coding_index')),
            'math': normalize_number(evaluations.get('artificial_analysis_math_index')),
            'reasoning': normalize_number(evaluations.get('gpqa'), 100),
            'knowledge': normalize_number(evaluations.get('mmlu_pro'), 100),
            'agentic': round((normalize_number(evaluations.get('livecodebench'), 100) + normalize_number(evaluations.get('scicode'), 100)) / 2, 2),
        },
        'meta': {
            'rank': rank,
            'slug': model.get('slug', ''),
            'creatorId': creator.get('id', ''),
            'creatorSlug': creator.get('slug', ''),
            'inputPrice': normalize_number(pricing.get('price_1m_input_tokens')),
            'outputPrice': normalize_number(pricing.get('price_1m_output_tokens')),
            'blendedPrice': normalize_number(pricing.get('price_1m_blended_3_to_1')),
            'tokensPerSecond': normalize_number(model.get('median_output_tokens_per_second')),
            'timeToFirstTokenSeconds': normalize_number(model.get('median_time_to_first_token_seconds')),
            'timeToFirstAnswerTokenSeconds': normalize_number(model.get('median_time_to_first_answer_token')),
        },
    }


def build_payload(response_payload: dict[str, Any], model_limit: int) -> dict[str, Any]:
    rows = response_payload.get('data', []) or []
    sorted_rows = sorted(
        rows,
        key=lambda item: normalize_number((item.get('evaluations', {}) or {}).get('artificial_analysis_intelligence_index')),
        reverse=True,
    )

    limited_rows = sorted_rows[:model_limit]
    models = [map_model(model, rank + 1) for rank, model in enumerate(limited_rows)]

    prompt_options = response_payload.get('prompt_options', {}) or {}

    return {
        'source': SOURCE_INFO,
        'categories': CATEGORIES,
        'regions': [
            {'key': 'cn', 'label': '中国阵营'},
            {'key': 'global', 'label': '全球阵营'},
        ],
        'models': models,
        'lastUpdated': datetime.now(timezone.utc).isoformat(),
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'stats': {
            'totalModels': len(models),
            'sourceRows': len(rows),
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
    response_payload = fetch_models(args.api_url, api_key, args.prompt_length, args.parallel_queries)
    payload = build_payload(response_payload, args.model_limit)
    write_payload(Path(args.output), payload)
    print(f"Generated {args.output} with {payload['stats']['totalModels']} models")


if __name__ == '__main__':
    main()
