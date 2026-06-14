const { createClient } = require('@supabase/supabase-js');

const supabase = createClient("https://fxksnkvyeyypkckehqpx.supabase.co", "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H");

async function run() {
  const { count: appCount, error: appError } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true });
  console.log("Applications count error:", appError);
  console.log("Applications count:", appCount);

  const { count: cvCount, error: cvError } = await supabase
    .from("cv_database")
    .select("*", { count: "exact", head: true });
  console.log("CV Database count error:", cvError);
  console.log("CV Database count:", cvCount);
}

run();
