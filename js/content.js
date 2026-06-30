(function () {
  const api = window.QuestionBank;

  if (api && typeof api.bindContentPage === "function") {
    window.bindContentPage = api.bindContentPage;
  }
})();
