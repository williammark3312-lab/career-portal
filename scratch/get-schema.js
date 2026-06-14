async function run() {
  const url = "https://fxksnkvyeyypkckehqpx.supabase.co/rest/v1/?apikey=sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H";
  try {
    const res = await fetch(url);
    const schema = await res.json();
    console.log("Tables in schema:", Object.keys(schema.paths));
    console.log("\ncv_database schema definition:", JSON.stringify(schema.definitions.cv_database, null, 2));
  } catch (err) {
    console.error("Error fetching schema:", err);
  }
}

run();
