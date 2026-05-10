const { app } = require('electron');
app.whenReady().then(() => {
  try {
    console.log("Attempting to require better_sqlite3.node...");
    require('./node_modules/better-sqlite3/build/Release/better_sqlite3.node');
    console.log("SUCCESS IN MAIN PROCESS");
    app.quit();
  } catch (e) {
    console.error("EXACT ERROR IN MAIN PROCESS:", e);
    app.quit();
  }
});
