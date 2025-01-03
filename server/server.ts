import { Application, Router, Context} from "https://deno.land/x/oak@v8.0.0/mod.ts"
import { Client } from "https://deno.land/x/mysql/mod.ts";
//import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";

import { User,Authentication,UserIDProcessing } from "./models/user.ts";
const userIDProcess = new UserIDProcessing();

const _env = config();  // .envファイルを読み込む

// MySQL接続設定
const client = new Client();
await client.connect({
    hostname: _env.MYSQL_HOST,  // MySQLのホスト名
    username: _env.MYSQL_USER,  // MySQLのユーザー名
    password: _env.MYSQL_PASSWORD,  // MySQLのパスワード
    db: _env.MYSQL_DATABASE,  // データベース名
    port: 3306,  // MySQLのポート番号
});

/*
console.log(_env.MYSQL_HOST);
console.log(_env.MYSQL_USER);
console.log(_env.MYSQL_PASSWORD);
console.log(_env.MYSQL_DATABASE);
console.log(_env.SECRET_KEY);
*/

const app = new Application();
const router = new Router();

//app.use(oakCors({origin: "*"}));

// ユーザーの登録処理
router.post("/signup", async (ctx: Context) => {
    const body = await ctx.request.body().value;
    const user = await new User(body.username, body.password,ctx);
    await user.Signup();
});

// ログイン処理
router.post("/login", async (ctx: Context) => {
    console.log("/login");
    const body = await ctx.request.body().value;
    const user = new User(body.username, body.password,ctx);
    await user.Login();
});

// ログアウト処理
router.get("/logout", async (ctx: Context) => {
    console.log("/logout");
    const auth = new Authentication(ctx);
    const logout = await auth.Logout();
    if (logout.status == 200) {
        ctx.response.redirect("/");
    }else{
        ctx.response.status = logout.status;
        ctx.response.body = logout.body;
    }
});

// Cookieに保存されたJWTを確認してユーザー情報を取得
router.get("/profile", async (ctx: Context) => {
    console.log("/profile");
    const auth = new Authentication(ctx);
    await auth.get_user();
    ctx.response.body = {username: auth.username};
});

// トップページ
router.get("/", async (ctx: Context) => {
    console.log("/");
    const auth = new Authentication(ctx);
    await auth.get_user();
    //ctx.response.body = await auth.get_user()
    if (auth.isLogin) {
        /* userIDProcessingのテスト
        const user_id = (await auth.get_user()).user_id;
        const name: string = await userIDProcess.getUsernameById(user_id);
        console.log(user_id);
        console.log(name);
        */
        ctx.response.body = Deno.readTextFileSync("./src/index.html");
    }else{
        ctx.response.body = Deno.readTextFileSync("./src/login.html");
    }
});

// サインアップページ
router.get("/signup", async (ctx: Context) => {
    console.log("/signup");
    const auth = new Authentication(ctx);
    await auth.get_user();
    //ctx.response.body = await auth.get_user()
    if (auth.isLogin) {
        ctx.response.body = Deno.readTextFileSync("./src/index.html");
    }else{
        ctx.response.body = Deno.readTextFileSync("./src/signup.html");
    };
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log("Server started on http://localhost:8000");
await app.listen({ port: 8000 });