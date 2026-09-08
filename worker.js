export default {
  async fetch(request, env) {
    return new Response("OWNews Automation: ONLINE", {
      headers: { "content-type": "text/plain; charset=UTF-8" }
    });
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runOWNews(env));
  }
};

async function runOWNews(env) {
  console.log("OWNews: iniciando atualização automática");
}
