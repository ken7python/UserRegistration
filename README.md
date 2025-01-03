## 説明
deno, TypeScript, oak, MySQL, HTML, JavaScript, BootStrapを使用したユーザー登録です。

## 使用方法

1. Denoの環境構築、MySQLの環境構築、ユーザーの作成
2. `setup.sql`の内容をMySQLで実行
3. `/server`に`.env`を追加し、以下の内容を追加
```
SECRET_KEY="Your SECRET KEY"
MYSQL_HOST="localhost"
MYSQL_USER="Your User Name"
MYSQL_PASSWORD="Your Password"
MYSQL_DATABASE="Your DataBase"
```
※SECRET_KEYは以下のコマンドで作成できます
```
deno run generateKey.ts
```

4. Denoで実行
```bash
deno run -A server.ts
```

## ライセンス
このプロジェクトはMITライセンスの下で公開されています。詳細はLICENSEファイルを参照してください。