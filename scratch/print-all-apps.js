const { createClient } = require('@supabase/supabase-js');

const supabase = createClient("https://fxksnkvyeyypkckehqpx.supabase.co", "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H");

async function run() {
  const { data, error } = await supabase.from("applications").select("*");
  console.log("Error:", error);
  console.log("Applications:");
  console.dir(data, { depth: null });
}

run();
