/**
 * MCP discovery / health (still requires Bearer API token via middleware).
 */
export default defineEventHandler(() => {
  return {
    ok: true,
    service: 'yuque-dl-mcp',
    transport: 'http+jsonrpc',
    endpoint: '/api/mcp',
    protocolVersion: '2024-11-05',
    auth: 'Authorization: Bearer <API_TOKEN>',
    methods: ['initialize', 'tools/list', 'tools/call', 'ping'],
    tools: [
      'yuque_status',
      'yuque_list_tasks',
      'yuque_get_task',
      'yuque_create_task',
      'yuque_cancel_task',
      'yuque_retry_task',
      'yuque_list_books',
      'yuque_export_book',
    ],
  }
})
