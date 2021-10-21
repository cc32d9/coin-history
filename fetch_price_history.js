"use strict";

const mariadb   = require('mariadb');
const config    = require('config');
const fetch     = require('node-fetch');
const datetime  = require('date-and-time');

const history_api = 'https://api.coingecko.com/api/v3/coins/';

const pool = mariadb.createPool(config.get('db'));
const start_date = new Date(config.get('start_date'));

const coins = config.get('coins');

var fetch_counter = 0;
var next_fetch_allowed = new Date();


for (const coin_name in coins) {
    let symbol_name = coins[coin_name];
    let current_date = start_date;

    pool.getConnection()
        .then(conn => {
            conn.query('SELECT MAX(price_date) AS last_date FROM PRICE_HISTORY WHERE coin_symbol=?', [symbol_name])
                .then((rows) => {
                    if( rows.length > 0 && rows[0].last_date !== null ) {
                        current_date = new Date(rows[0].last_date);
                        current_date = datetime.addDays(current_date, 1);
                    }
                    fetch_coin_history(coin_name, coins[coin_name], current_date);
                })
                .catch(err => {
                    console.log(err);
                })
                .finally(() => {
                    conn.release();
                });
        })
        .catch(err => {
            console.log(err);
        });
}


// Cpingecko limits to 50 requests per minute -> 12 requests per 10 seconds.

async function fetch_coin_history(coin_name, symbol_name, current_date)
{
    let now = new Date();
    if( now - current_date < 24*3600*1000 ) { // we need yesterday's price
        let delay = now + 3*3600*1000;
        console.log('Delay: ' + delay);
        setTimeout(fetch_coin_history, delay, coin_name, symbol_name, current_date);
        return;
    }
            
    if( fetch_counter >= 12 ) {
        let passed = now - next_fetch_allowed;
        console.log('Reached maximum. Passed: ' + passed);
        next_fetch_allowed = datetime.addMilliseconds(now, 10000 - passed);
        fetch_counter = 0;
    }

    if( now < next_fetch_allowed ) {
        let delay = next_fetch_allowed - now + (fetch_counter * 50);
        console.log('Delay: ' + delay);
        setTimeout(fetch_coin_history, delay, coin_name, symbol_name, current_date);
    }
    else {
        fetch_counter++;
        let url = history_api + coin_name + '/history?localization=false&date=' + datetime.format(current_date, 'DD-MM-YYYY');
        console.log('fetching ' + url);

        let response = await fetch(url);
        if (response.ok) {
            let resp_data = await response.json();
            if( resp_data["market_data"] != null && resp_data["market_data"]["current_price"] != null ) {
                let price = resp_data["market_data"]["current_price"]["usd"];
                console.log('Price: ' + symbol_name + ' ' + price);

                pool.getConnection()
                    .then(conn => {
                        conn.query('INSERT INTO PRICE_HISTORY (coin_symbol, price_date, usd_price) ' +
                                   'VALUES(?, ?, ?)', [symbol_name, datetime.format(current_date, 'YYYY-MM-DD'), price])
                            .catch(err => {
                                console.log(err);
                            })
                            .finally(() => {
                                conn.release();
                            });
                    })
                    .catch(err => {
                        console.log(err);
                    });
            }

            fetch_coin_history(coin_name, symbol_name, datetime.addDays(current_date, 1));
        }
        else {
            setTimeout(fetch_coin_history, 1000, coin_name, symbol_name, current_date);
        }
    }
}
