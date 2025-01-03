import { Application, Router, Context} from "https://deno.land/x/oak@v8.0.0/mod.ts"
//import { create, verify, getNumericDate } from "https://deno.land/x/djwt/mod.ts";
import { Client } from "https://deno.land/x/mysql/mod.ts";
//import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";

import { User,Certification } from "./models/user.ts";

const _env = config();  // .envファイルを読み込む

// MySQL接続設定
const client = new Client();
await client.connect({
    hostname: _env.MYSQL_HOST,  // MySQLのホスト名
    username: _env.MYSQL_USER,  // MySQLのユーザー名
    password: _env.MYSQL_PASSWORD,  // MySQLのパスワード
    db: _env.MYSQL_DATABASE,  // データベース名
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

app.use(oakCors({origin: "*"}));




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
router.get("/logout", (ctx: Context) => {
    console.log("/logout");
    ctx.cookies.delete("token");
    ctx.response.redirect("/");
});



router.get("/profile", async (ctx: Context) => {
    console.log("/profile");
    const certification = new Certification(ctx);
    ctx.response.body = {username: (await certification.get_user()).username};
});

router.get("/", async (ctx: Context) => {
    console.log("/");
    const certification = new Certification(ctx);
    ctx.response.body = await certification.get_user()
    if ((await certification.get_user()).status) {
        ctx.response.body = Deno.readTextFileSync("./src/index.html");
    }else{
        ctx.response.body = Deno.readTextFileSync("./src/login.html");
    }
});

router.get("/signup", async (ctx: Context) => {
    console.log("/signup");
    const certification = new Certification(ctx);
    ctx.response.body = await certification.get_user()
    if ((await certification.get_user()).status) {
        ctx.response.body = Deno.readTextFileSync("./src/index.html");
    }else{
        ctx.response.body = Deno.readTextFileSync("./src/signup.html");
    };
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log("Server started on http://localhost:8000");
await app.listen({ port: 8000 });