const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://fxksnkvyeyypkckehqpx.supabase.co";
const supabaseAnonKey = "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const appId = "64b00f31-933c-47df-ba8e-98631d0a524a"; // Sona kesav (known application ID)
  console.log(`Testing UPDATE on applications table for ID: ${appId}...`);
  
  // Try updating the notes to the same value to test permission
  const { data: readData } = await supabase
    .from("applications")
    .select("notes")
    .eq("id", appId)
    .single();

  if (!readData) {
    console.error("Could not read application data");
    return;
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({ notes: readData.notes })
    .eq("id", appId)
    .select();

  console.log("Update applications error:", updateError);
}

run();
