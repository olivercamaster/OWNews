async fetch(request, env) {
  return env.ASSETS.fetch(request);
},

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runOWNews(env));
  }
};

async function runOWNews(env) {
  console.log("OWNews: iniciando atualização automática");
}
