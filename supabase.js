
const supabase = createClient("YOUR_SUPABASE_URL", "YOUR_SUPABASE_KEY");

// messages.jsonを読み込む
const messages = JSON.parse(fs.readFileSync("messages.json", "utf-8"));

// そのままSupabaseに保存
const { error } = await supabase
  .from("chat_json")
  .insert({ data: messages });

if (error) {
  console.error("保存失敗", error);
} else {
  console.log("✅ messages.json をSupabaseに保存しました!");
}
