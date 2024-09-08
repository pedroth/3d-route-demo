openssl genrsa -out key.pem 2048
openssl req -new -key key.pem -out csr.pem -subj "/C=/ST=/L=/O=/OU=/CN="
openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out cert.pem

bunx http-server -S -C cert.pem -K key.pem