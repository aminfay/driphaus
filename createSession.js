const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');
const fetch = require('node-fetch');
const chalk = require('chalk');
const nacl = require('tweetnacl');
const fs = require('fs');

const getSession = () => new Promise((resolve, reject) => {
    fetch('https://nox.solanaspaces.com/spaces_nft_list_one/session', {
        method: 'POST',
        headers: {
            'authority': 'nox.solanaspaces.com',
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.6',
            'content-length': '0',
            'content-type': 'application/json',
            'origin': 'https://drip.haus',
            'referer': 'https://drip.haus/',
            'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Brave";v="114"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'sec-gpc': '1',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        }
    }).then(res => res.json())
        .then(res => resolve(res))
        .catch(err => reject(err))
});

const verifyPubkey = (sessionId, signature, address) => new Promise((resolve, reject) => {
    fetch('https://nox.solanaspaces.com/spaces_nft_list_one/pubkey/verify', {
        method: 'POST',
        headers: {
            'authority': 'nox.solanaspaces.com',
            Authorization: `Bearer ${sessionId}`,
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.6',
            'content-length': '0',
            'content-type': 'application/json',
            'origin': 'https://drip.haus',
            'referer': 'https://drip.haus/',
            'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Brave";v="114"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'sec-gpc': '1',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
            signature,
            address,
        })
    }).then(res => res.json())
        .then(res => resolve(res))
        .catch(err => reject(err))
});

const checkSessionData = (sessionId) => new Promise((resolve, reject) => {
    fetch('https://nox.solanaspaces.com/spaces_nft_list_one/session', {
        headers: {
            'authority': 'nox.solanaspaces.com',
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.6',
            'authorization': 'Bearer ' + sessionId,
            'content-type': 'application/json',
            'origin': 'https://drip.haus',
            'referer': 'https://drip.haus/',
            'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Brave";v="114"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'sec-gpc': '1',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        }
    }).then(res => res.json())
        .then(res => resolve(res))
        .catch(err => reject(err))
});


(async () => {

    if (!fs.existsSync('./sessions')) {
        fs.mkdirSync('./sessions')
    }


    if (!fs.existsSync('./privatekey.txt')) {
        console.log(chalk.red('File privatekey.txt tidak ditemukan!'));
        process.exit(0);
    }

    const privateKeyList = fs.readFileSync('./privatekey.txt', 'utf-8').split('\n');
    if (privateKeyList.length < 1) {
        console.log(chalk.red('privateKey tidak boleh kosong!'));
        process.exit(0);
    }

    console.log('')
    for (let index = 0; index < privateKeyList.length; index++) {
        const privateKey = privateKeyList[index];
        const uint8ArraySecretKey = bs58.decode(privateKey);
        const walleyKeypair = Keypair.fromSecretKey(uint8ArraySecretKey);

        // const privateKeyBs58 = bs58.encode(walleyKeypair.secretKey);
        const publicKeyString = walleyKeypair.publicKey.toBase58();


        try {

            let sessionFolder = './sessions/' + publicKeyString;
            let sessionData = [];
            let sessionDataResult;

            console.log(chalk.cyan(`Check existing session for account ${publicKeyString}`));

            if (fs.existsSync(sessionFolder)) {
                console.log(chalk.yellow(`Existing Session Found, checking...`));
                const files = fs.readdirSync(sessionFolder);
                files.forEach(file => {
                    sessionData.push(file)
                });

                if (sessionData.length > 0) {
                    sessionDataResult = await checkSessionData(sessionData[0]);
                    if (sessionDataResult.error) {
                        console.log(chalk.red(`Session expired.`));
                        sessionData = []
                        files.forEach(file => {
                            fs.unlinkSync(sessionFolder + `/${file}`);
                        });
                    } else {
                        console.log(chalk.green(`Succesfully login existing session!`));
                    }
                }
            }

            if (sessionData.length > 0) {
                console.log(sessionDataResult)
            } else {
                console.log(chalk.yellow(`Try logging into the account : ${publicKeyString}`));
                const sessionResult = await getSession();
                if (sessionResult.bearer) {
                    console.log(chalk.green(`Session ID : ${sessionResult.bearer}`))
                    console.log(chalk.yellow(`Verifying...`))
                    const message = new TextEncoder().encode(`Login Challenge: ${sessionResult.bearer}`);
                    const signature = nacl.sign.detached(message, walleyKeypair.secretKey);
                    const verifySignatureResult = await verifyPubkey(
                        sessionResult.bearer,
                        bs58.encode(signature),
                        publicKeyString
                    );

                    if (verifySignatureResult.ok === true) {
                        const sessionDataResult = await checkSessionData(sessionResult.bearer);

                        if (!fs.existsSync(sessionFolder)) {
                            fs.mkdirSync(sessionFolder);
                        }

                        fs.writeFileSync(sessionFolder + `/${sessionResult.bearer}`, '');
                        console.log(chalk.green(`Successfully Login!`))
                        console.log(sessionDataResult)
                    }
                }
            }
        } catch (error) {
            console.log(chalk.red(`ada masalah ketika check session account ${publicKeyString}`));
        }
        console.log('')
    }







})();