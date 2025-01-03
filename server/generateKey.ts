const encoder = new TextEncoder();
const key = crypto.getRandomValues(new Uint8Array(32));
const secretKey = btoa(String.fromCharCode(...key));
console.log("Generated Secret Key:", secretKey);