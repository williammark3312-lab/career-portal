const { createClient } = require('@supabase/supabase-js');

const supabase = createClient("https://fxksnkvyeyypkckehqpx.supabase.co", "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H");

async function run() {
  const { data, error } = await supabase.from("cv_database").select("*");
  console.log("cv_database list error:", error);
  console.log("cv_database list data:", data);
}

run();
