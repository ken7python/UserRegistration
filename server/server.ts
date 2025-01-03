import { Application, Router, Context} from "https://deno.land/x/oak@v8.0.0/mod.ts"
import { create, verify, getNumericDate } from "https://deno.land/x/djwt/mod.ts";
import { Client } from "https://deno.land/x/mysql/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";

const _env = config();  // .envファイルを読み込む

/*
console.log(_env.MYSQL_HOST);
console.log(_env.MYSQL_USER);
console.log(_env.MYSQL_PASSWORD);
console.log(_env.MYSQL_DATABASE);
*/


// MySQL接続設定
const client = new Client();
await client.connect({
    hostname: _env.MYSQL_HOST,  // MySQLのホスト名
    username: _env.MYSQL_USER,  // MySQLのユーザー名
    password: _env.MYSQL_PASSWORD,  // MySQLのパスワード
    db: _env.MYSQL_DATABASE,  // データベース名
});

//const SECRET_KEY = "your-secret-key";  // JWT用のシークレットキー

const SECRET_KEY: CryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(_env.SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
);

//console.log(_env.SECRET_KEY);

const app = new Application();
const router = new Router();

app.use(oakCors({origin: "*"}));

// JWTを生成する関数
async function generateJWT(username: string) {
    const payload = {
        iss: username,
        exp: getNumericDate(60 * 60),  // 1時間有効
    };
    return await create({ alg: "HS256", typ: "JWT" }, payload, SECRET_KEY);
}

class User{
    username: string;
    password: string;
    constructor(username: string, password: string){
        this.username = username;
        this.password = password;
    }

    // CookieにJWTを保存する関数
    async setCookie(ctx: Context){
        // JWTを生成してCookieに保存
        const jwt = await generateJWT(this.username);
        //console.log("jwt: " + jwt);
        ctx.cookies.set("token", jwt, {
            httpOnly: true,
            //secure: true,  // 本番環境ではHTTPSを使用する
            secure: false,
            sameSite: "strict",
        });
    };
};
// JWT検証
class Certification{
    ctx : Context;
    username: string;
    user_id: string;
    constructor(Context: Context){
        this.ctx = Context;
        this.username = "";
        this.user_id = "";
    }

    async profile(ctx: Context) {
        const token = await ctx.cookies.get("token");
        //console.log("token: " + token);
        if (!token) {
            //ctx.response.status = 401;
            //ctx.response.body = { message: "認証されていません" };
            return {status: 401, body: {message: "認証されていません"} };
        }
    
        try {
            const payload = await verify(token, SECRET_KEY, { alg: "HS256" });
            const result = await client.query("SELECT user_id FROM users WHERE username = ?", [payload.iss]);
            if (result.length === 0) {
                //ctx.response.status = 401;
                //ctx.response.body = { message: "認証されていません" };
                return {status: 401, body: {message: "認証されていません"} };
            }
            ctx.response.body = { username: payload.iss, user_id: result[0].user_id };
            return {status: 200, body: { username: payload.iss, user_id: result[0].user_id,message: "OK" }};
        } catch(err) {
            console.error(err);
            //ctx.response.status = 401;
            //ctx.response.body = { message: "認証されていません" };
            return {status: 401, body: {message: "認証されていません"} };
        }
    }
    async get_user(){
        const res = await this.profile(this.ctx);
        let status: boolean = false;
        if (res.status === 401 || res.body.username === undefined) {
            status = false;
        }else if(res.status === 200){
            status = true;
            this.username = res.body.username;
            this.user_id = res.body.user_id;
        }
        //ctx.response.status = res.status;
        //ctx.response.body = res.body;
        return {username: this.username,user_id: this.user_id,status: status};
    }
}


// ユーザーの登録処理
router.post("/signup", async (ctx: Context) => {
    const body = await ctx.request.body().value;
    /*
    const username = body.username;
    const password = body.password;
    */
    const user = new User(body.username, body.password);

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(user.password);

    // ユーザー情報をデータベースから取得
    const result = await client.query("SELECT * FROM users WHERE username = ?", [user.username]);

    if (result.length > 0) {
        ctx.response.status = 401;
        ctx.response.body = { message: "同じ名前の人がいるので登録できません" };
        return;
    }

    try {
        // ユーザー情報をデータベースに保存
        await client.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [user.username, hashedPassword]
        );
        await user.setCookie(ctx);
        ctx.response.status = 201;
        ctx.response.body = {message: "User registered successfully"};
    } catch (error) {
        console.error(error);
        ctx.response.status = 400;
        ctx.response.body = { message: "ユーザー登録エラー", error: (error as any).message };
    }
});

// ログイン処理
router.post("/login", async (ctx: Context) => {
    console.log("/login");
    const body = await ctx.request.body().value;
    //console.log(body);
    /*
    const username = body.username;
    const password = body.password;
    */
    const user = new User(body.username, body.password);

    // ユーザー情報をデータベースから取得
    const result = await client.query("SELECT * FROM users WHERE username = ?", [user.username]);

    if (result.length === 0) {
        ctx.response.status = 401;
        ctx.response.body = { message: "そのようなユーザーは登録されていません。" };
        return;
    }

    // パスワードが一致するか確認
    const isPasswordValid = await bcrypt.compare(user.password, result[0].password);
    if (!isPasswordValid) {
        ctx.response.status = 401;
        ctx.response.body = { message: "ユーザー名とパスワードが一致しまsん" };
        return;
    }

    await user.setCookie(ctx);

    ctx.response.status = 200;
    //ctx.response.body = { message: "Login successful" };
    console.log("Login successful");
    ctx.response.body = { message: "Login successful"};
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