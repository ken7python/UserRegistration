import { Context} from "https://deno.land/x/oak@v8.0.0/mod.ts"
import { create, verify, getNumericDate } from "https://deno.land/x/djwt/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt/mod.ts";
import { Client } from "https://deno.land/x/mysql/mod.ts";

const _env = config();  // .envファイルを読み込む

// MySQL接続設定
const client = new Client();
await client.connect({
    hostname: _env.MYSQL_HOST,  // MySQLのホスト名
    username: _env.MYSQL_USER,  // MySQLのユーザー名
    password: _env.MYSQL_PASSWORD,  // MySQLのパスワード
    db: _env.MYSQL_DATABASE,  // データベース名
});

const SECRET_KEY: CryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(_env.SECRET_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
);

// JWTを生成する関数
async function generateJWT(username: string) {
    const payload = {
        iss: username,
        exp: getNumericDate(60 * 60),  // 1時間有効
    };
    return await create({ alg: "HS256", typ: "JWT" }, payload, SECRET_KEY);
}

//ユーザー情報とクッキーの管理
export class User{
    username: string;
    password: string;
    HasedPassword: string;
    ctx : Context;
    constructor(username: string, password: string,ctx: Context){
        this.username = username;
        this.password = password;
        this.ctx = ctx;
        this.HasedPassword = bcrypt.hashSync(this.password);
    };

    // CookieにJWTを保存する関数
    async SetCookie(){
        // JWTを生成してCookieに保存
        const jwt = await generateJWT(this.username);
        //console.log("jwt: " + jwt);
        this.ctx.cookies.set("token", jwt, {
            httpOnly: true,
            //secure: true,  // 本番環境ではHTTPSを使用する
            secure: false,
            sameSite: "strict",
        });
    };
    // ユーザー名が既に登録されているか確認
    async IsSameUser(){
        const result = await client.query("SELECT * FROM users WHERE username = ?", [this.username]);
        if (result.length > 0) {
            return true;
        }else{
            return false;
        }
    }
    async Signup(){
        if (await this.IsSameUser()) {
            this.ctx.response.status = 401;
            this.ctx.response.body = { message: "同じ名前の人がいるので登録できません" };
            return;
        }else{
            try {
                // ユーザー情報をデータベースに保存
                await this.AddDB();
                await this.SetCookie();
                this.ctx.response.status = 201;
                this.ctx.response.body = {message: "User registered successfully"};
            } catch (error) {
                console.error(error);
                this.ctx.response.status = 400;
                this.ctx.response.body = { message: "ユーザー登録エラー", error: (error as any).message };
            }
        }
    }
    async AddDB(){
        await client.execute(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [this.username, this.HasedPassword]
        );
    }
    async Login(){
        if (!await this.IsSameUser()) {
            this.ctx.response.status = 401;
            this.ctx.response.body = { message: "そのようなユーザーは登録されていません。" };
            return;
        }
        const result = await client.query("SELECT * FROM users WHERE username = ?", [this.username]);
        const isPasswordValid = await bcrypt.compare(this.password, result[0].password);
        if (isPasswordValid) {
            await this.SetCookie();
            this.ctx.response.status = 200;
            this.ctx.response.body = { message: "Login successful"};
        }else{
            this.ctx.response.status = 401;
            this.ctx.response.body = { message: "ユーザー名とパスワードが一致しません" };
            return;
        }
    }
};
// Cookieを読み出し、JWT検証、User情報の取得
export class Certification{
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