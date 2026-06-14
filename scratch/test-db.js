const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://fxksnkvyeyypkckehqpx.supabase.co";
const supabaseAnonKey = "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const realId = "64b00f31-933c-47df-ba8e-98631d0a524a";
  console.log(`Querying applications table with real ID: ${realId}...`);
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("id", realId);
  
  console.log("applications error:", error);
  console.log("applications data:", data);
}

run();
