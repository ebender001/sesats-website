function initBack4App() {
  if (typeof Parse === "undefined") {
    console.error("Parse SDK is not loaded.");
    return;
  }

  Parse.initialize(
    "uYbcV87y6RkA7YbT6HdMjEP84x1oDKbDP2ZFsoHM",
    "7twrHt8H6xKBJTyqu1ObcIUqQnKH0NIyChnKCHr5"
  );
  Parse.serverURL = "https://parseapi.back4app.com";
  console.log("Back4App initialized.");
}

async function runCloudFunction(functionName, params = {}) {
  if (typeof Parse === "undefined") {
    throw new Error("Parse SDK is not available.");
  }

  try {
    return await Parse.Cloud.run(functionName, params);
  } catch (error) {
    console.error(`Back4App cloud function failed: ${functionName}`, error);
    throw error;
  }
}

window.back4app = {
  init: initBack4App,
  runCloudFunction,
};
