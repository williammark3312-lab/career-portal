const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://fxksnkvyeyypkckehqpx.supabase.co";
const supabaseAnonKey = "sb_publishable_m-6h20CT-bCsXpkRPOtZ2Q_g98HQo8H";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Inserting a test candidate into cv_database...");
  const { data: insertData, error: insertError } = await supabase
    .from("cv_database")
    .insert([
      {
        name: "Test Candidate",
        email: "test@candidate.com",
        phone: "+91 9999999999",
        status: "Not Called",
        comments: JSON.stringify({ comments: [], interview: null })
      }
    ])
    .select()
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    return;
  }
  
  const newId = insertData.id;
  console.log("Inserted candidate ID:", newId);

  console.log(`Querying cv_database with inserted ID: ${newId}...`);
  const { data: readData, error: readError } = await supabase
    .from("cv_database")
    .select("*")
    .eq("id", newId)
    .single();

  console.log("Read error:", readError);
  console.log("Read data:", readData);

  // Clean up
  console.log("Cleaning up test candidate...");
  const { error: deleteError } = await supabase
    .from("cv_database")
    .delete()
    .eq("id", newId);
  console.log("Delete error:", deleteError);
}

run();
