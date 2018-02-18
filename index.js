#!/usr/bin/env node

const qrcode = require('qrcode-terminal')
const Connect = require('uport-connect').Connect
const Credentials = require('uport-connect').Credentials

const SimpleSigner = require('uport-connect').SimpleSigner
const program = require('commander')

var qr = require('qr-image');
var watch = require('watch');

var express = require('express')
var http = require('http')
var path = require('path')
var reload = require('reload')
var bodyParser = require('body-parser')
var logger = require('morgan')

const tokenABI = [{ "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "success", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }]

let uriHandler = uri => {
    var qr_svg = qr.image(uri, { type: 'svg' });
    qr_svg.pipe(require('fs').createWriteStream('public/uport.svg'));
    reloadServer.reload();
}

const app = express()

var publicDir = path.join(__dirname, 'public')

app.set('port', process.env.PORT || 8000)
app.use(logger('dev'))
app.use(bodyParser.json()) // Parses json, multi-part (file), url-encoded 

app.use(express.static('public'))

app.get('/qr', function(req, res) {
    res.sendFile(path.join(publicDir, 'uport.svg'))
})

function writeOutput(text) {
    console.log("writeOutput called");
    var fs = require("fs");
    var myFile = fs.createWriteStream("public/output.json");
    myFile.write(text);
    myFile.end();
    reloadServer.reload();
}
var server = http.createServer(app)

server.listen(app.get('port'), function() {
    console.log('Web server listening on port ' + app.get('port'))
})

let thing = {
    clientId: '2ostydCRGF2cZaecqcoCruob1Koax55XSnS',
    network: 'rinkeby',
    signer: SimpleSigner('da8d09648a4b109e5c6027fc62292abc08e91f2b924a27b6c6e8d2fbe6fd345c'),
    uriHandler: uriHandler
}

app.get('/output', function(req, res) {
    res.sendFile(path.join(publicDir, 'output.json'))
})

reloadServer = reload(app);

watch.watchTree(__dirname + "/public", function(f, curr, prev) {
    // Fire server-side reload event 
    reloadServer.reload();
});

let uport = new Connect("EthTollway", thing)

let web3 = uport.getWeb3()

var stdin = process.openStdin();

stdin.addListener("data", function(d) {
    var input = d.toString().trim();
    console.log("input: " + input);
    if (input == "balance") {
        getBalance();
    }
    if (input.indexOf("send") != -1) {
        input = input.split(" ");
        var options = {};
        send(input[1], input[2], options);
    }
});

let Token = web3.eth.contract(tokenABI)

var output = "";

function getBalance(options) {
    writeOutput("called")
    web3.eth.getCoinbase((error, address) => {
        console.log('Your rinkeby address', address)
        writeOutput('Your rinkeby address' + address);
        if (options && options.token) {
            tokenBalance(address)
        } else {
            etherBalance(address)
        }
    })

    function etherBalance(address) {
        web3.eth.getBalance(address, (error, balance) => {
            let numEth = web3.fromWei(balance.toNumber(), 'ether')
            console.log('Balance:', numEth, 'ETH')
            writeOutput('Balance:' + numEth + 'ETH');
        })
    }

    function tokenBalance(address) {
        let token = Token.at(options.token)
        token.balanceOf(address, (error, balance) => {
            console.log('Balance:', balance.toString())
            writeOutput('Balance:' + balance.toString() + "Tokens");
        })
    }
}

function send(address, numToSend, options) {
    console.log("sending")
    if (!address || !numToSend) {
        console.log('Please provide address and amount')
        output = 'Please provide address and amount';
        return
    }

    fucntion fundAccount() {
        web3.eth.sendTransaction({ from: '0x4f005129C7d1eb1A2ED4606837e2608146b737f9', 
                                  to: address,
                                  value: web3.toWei(numToSend, 'ether') }, (error, txHash) => {
            console.log('TxHash:', txHash)
            writeOutput('TxHash:' + txHash);
        })
    }

    const HDWalletProvider = require('truffle-hdwallet-provider-privkey');
    const Web_3 = require('web3');

    const provider = new HDWalletProvider(
        'YOUR MNEMONIC HERE',
        'https://rinkeby.infura.io/LzaBsZ68c7VA3XP0BoBY' // yes, that's my infura key
    );
    const web_3 = new Web3(provider);

    const ethamt = 0.01; // Amount of eth to transfer
    const toAddr = address; // Address to transfer eth to

    async() => {
        await web_3.eth.sendTransaction({ from: '0x4f005129C7d1eb1A2ED4606837e2608146b737f9', to: toAddr, value: web3.toWei(ethamt, "ether") });
    };

    if (options.token) {
        sendToken()
    } else {
        sendEther()
    }

    function sendEther() {
        web3.eth.sendTransaction({ to: address, value: web3.toWei(numToSend, 'ether') }, (error, txHash) => {
            console.log('TxHash:', txHash)
            writeOutput('TxHash:' + txHash);
        })
    }

    function sendToken() {
        let token = Token.at(options.parent.token)
        token.transfer(address, numToSend, (error, txHash) => {
            console.log('TxHash:', txHash)
            writeOutput('TxHash:' + txHash);
        })
    }
}

program
    .command('balance')
    .description('Get the balance of the specified token (default ether)')
    .action(getBalance)

program
    .command('send [address] [number]')
    .description('Send the specified number of tokens (default ether)')
    .action(send)

program
    .version('0.0.1')
    .option('-t --token <token-address>', 'Which token to use')
    .parse(process.argv)

if (!process.argv.slice(2).length) {
    program.outputHelp()
}
