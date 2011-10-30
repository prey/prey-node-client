#!/bin/sh
# generates self-signed certificates for On-Demand TLS Connection
curr_path=$(dirname $0)

cleanup(){
	rm -f "$curr_path/*.key"
	rm -f "$curr_path/*.csr"
	rm -f "$curr_path/*.cert"
}

generate_key(){
	echo "Generating new private key..."
	openssl genrsa -out "$curr_path/ssl.key" 1024
}

signed_by_ca(){
	echo "Generating Certificate Authority certificate"
	openssl req -new -x509 -config "$curr_path/ca.cnf" -keyout "$curr_path/ca.key" -out "$curr_path/ca.cert"

	echo "Creating a Certificate Signing Request for the key..."
	openssl req -new -config "$curr_path/ssl.cnf" -key "$curr_path/ssl.key" -out "$curr_path/ssl.csr"

	echo "Generating new certificate..."
	openssl x509 -req \
		-days 365 \
		-passin "pass:password" \
		-in "$curr_path/ssl.csr" \
		-CA "$curr_path/ca.cert" \
		-CAkey "$curr_path/ca.key" \
		-CAcreateserial \
		-out "$curr_path/ssl.cert"

	echo "Verifying certificate..."
	 openssl verify -CAfile "$curr_path/ca.cert" "$curr_path/ssl.cert"
}

self_signed(){

	echo "Generating new certificate..."
	openssl req -new -config "$curr_path/ssl.cnf" -key "$curr_path/ssl.key" -x509 -days 999 -out "$curr_path/ssl.cert"

	echo "Verifying certificate..."
	openssl verify "$curr_path/ssl.cert"

}

cleanup
generate_key

# self_signed
signed_by_ca
