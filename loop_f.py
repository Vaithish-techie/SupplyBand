while True:
    supplier_impact_data = None
    for d in all_msgs:
        if isinstance(d, dict) and d.get('agent') == 'supplier_impact' and (d.get('case_id') == case_id):
            supplier_impact_data = d
            break
    if supplier_impact_data:
        break
    print(f'[FINANCIAL_EXPOSURE] Polling for supplier_impact...')
    await asyncio.sleep(5)
    try:
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