export async function POST() {
  return new Response(
    JSON.stringify({
      ok: false,
      message: 'Reminder dispatch is not enabled yet.'
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )
}