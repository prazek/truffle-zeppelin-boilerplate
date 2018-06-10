const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require("fs");
const app = express();
const Web3 = require('web3');

const web3 = new Web3.providers.HttpProvider("http://localhost:9545");

const KittyHubChannel = require('truffle-contract')(
    JSON.parse(fs.readFileSync(path.join(__dirname,
                                         '..',
                                         'build',
                                         'contracts',
                                         'KittyHubChannel.json'))));

console.log(web3);
console.log(web3.currentProvider);
KittyHubChannel.setProvider(web3);
if (typeof KittyHubChannel.currentProvider.sendAsync !== 'function') {
    KittyHubChannel.currentProvider.sendAsync = function(...args) {
        return KittyHubChannel.currentProvider.send(...args);
    };
}


var address;

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));


app.get('/contract', async(req, res) => {
    console.log("contract");
    console.log(address);
   res.json({contract: KittyHubChannel, address: address});
});

app.get('/kittensSeen', async(req, res) => {
    console.log("seen");
    console.log(address);
    res.json({seen: 42});
});




app.post('/kitten', async (req, res) => {
    console.log("server kitten!");
    const {user, sig} = req.body;
    const balance = web3.utils.toBN(req.body.balance);

    res.json({url: (await cats.get()).images.image.url});
});


KittyHubChannel.deployed().then(async instance => {
    address = instance.address;
    app.listen(3000, () => {
        console.log('Example app listening on port 3000!');

        console.log(address);
    });
});

