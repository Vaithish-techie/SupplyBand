while True:
    found = set()
    for d in all_msgs:
        if not isinstance(d, dict):
            continue
        agent_name = d.get('agent')
        if agent_name == 'supplier_impact' or agent_name == 'financial_exposure' or agent_name == 'regulatory_trade':
            if d.get('case_id') == case_id and d.get('status') in ('complete', 'insufficient_data', 'escalate', 'error', 'fallback'):
                found.add(agent_name)
    if 'supplier_impact' in found and 'financial_exposure' in found and ('regulatory_trade' in found):
        break
    logger.info(f'alt_sourcing polling... Found: {found}. Waiting for: {required_agents - found}')
    await asyncio.sleep(5)
    try:
        import httpx
        from band.config import load_agent_config
        _, api_key = load_agent_config('alt_sourcing')
        new_msgs = []
        async with httpx.AsyncClient() as client:
            all_messages = []
            for page_num in range(1, 6):
                resp = await client.get(f'https://app.band.ai/api/v1/agent/chats/{room_id}/context?page={page_num}&page_size=100', headers={'x-api-key': api_key})
                if resp.status_code != 200:
                    continue
                data = resp.json()
                messages = data.get('data', []) if isinstance(data, dict) else data
                if messages and isinstance(messages, list):
                    all_messages.extend(messages)
                    logger.info(f'Fetched page {page_num}: {len(messages)} messages (total so far: {len(all_messages)})')
            for m in all_messages:
                if not isinstance(m, dict):
                    continue
                parsed_data = m.get('parsed')
                if isinstance(parsed_data, dict) and parsed_data:
                    new_msgs.append(parsed_data)
                    continue
                content = m.get('content', '')
                if content.startswith('[') and ']: ' in content:
                    content = content.split(']: ', 1)[1]
                if '{' in content:
                    content = content[content.find('{'):content.rfind('}') + 1]
                try:
                    parsed = json.loads(content)
                    if isinstance(parsed, dict):
                        new_msgs.append(parsed)
                except Exception:
                    pass
            all_msgs = new_msgs
    except Exception as e:
        logger.warning(f'Polling error: {e}')