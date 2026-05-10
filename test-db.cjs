const { app } = require('electron');
app.whenReady().then(() => {
  try {
    const Database = require('better-sqlite3');
    console.log("SUCCESS LOADING BETTER-SQLITE3");
    app.quit();
  } catch (e) {
    console.error("EXACT ERROR IN DB LOAD:", e);
    app.quit();
  }
});
