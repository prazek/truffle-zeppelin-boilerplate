const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();


app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));


app.post('/kitten', async (req, res) => {
    console.log("server kitten!");
    const {user, sig} = req.body;
    const balance = web3.utils.toBN(req.body.balance);
    const cost = web3.utils.toBN(web3.utils.toWei('1', 'finney'));
    /* ... */
    res.json({url: (await cats.get()).images.image.url});
});

app.listen(3000, () => console.log('Example app listening on port 3000!'));