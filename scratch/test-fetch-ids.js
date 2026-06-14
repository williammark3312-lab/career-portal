const { createClient } = require('@supabase/supabase-js');

const supabase = createClient("https://fxksnkvyeyypkckehqpx.supabase.co", "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H");

const ids = [
  "cb6bb292-b374-40c5-a206-ace021288b5a", // Anandu
  "64b00f31-933c-47df-ba8e-98631d0a524a", // Sona kesav
  "7172b099-b370-4fdf-a5df-64a3dd6ad05a"  // Xxx
];

async function checkId(id) {
  console.log(`\n================ Checking ID: ${id} ================`);
  
  // 1. Check applications
  const { data: appData, error: appError } = await supabase
    .from("applications")
    .select("*")
    .eq("id", id)
    .single();

  console.log("Applications Query:");
  console.log("  error:", appError ? appError.message : "null");
  console.log("  data:", appData ? { name: appData.name, status: appData.status, hasNotes: !!appData.notes } : "null");

  if (appError || !appData) {
    // 2. Check cv_database
    const { data: cvData, error: cvError } = await supabase
      .from("cv_database")
      .select("*")
      .eq("id", id)
      .single();

    console.log("CV Database Query:");
    console.log("  error:", cvError ? cvError.message : "null");
    console.log("  data:", cvData ? { name: cvData.name, status: cvData.status, hasComments: !!cvData.comments } : "null");
  }
}

async function run() {
  for (const id of ids) {
    await checkId(id);
  }
}

run();
