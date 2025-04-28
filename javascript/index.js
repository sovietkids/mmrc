
//ありがとうAIさん
// ローカルストレージからパスワード解除状態を取得
let passwordunlocked = localStorage.getItem("passwordunlocked");

// "true" のときに main.html にリダイレクト
if (passwordunlocked === "true") {
    location.href = "main.html";
}

// パスワード確認処理
function passwordconfirmation() {
    // 入力フィールドから値を取得（input の id が "passwordInput" である必要あり）
    let inputpassword = document.getElementById("password").value;

    console.log(inputpassword);

    // 正しいパスワードと比較
    if (inputpassword === "manmaru3219") {
        console.log("true");
        localStorage.setItem("passwordunlocked", "true");
        location.href = "main.html";
    }
}