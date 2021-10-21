CREATE TABLE PRICE_HISTORY (
  id           INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  coin_symbol  VARCHAR(10) NOT NULL,
  price_date   DATE NOT NULL,
  usd_price    DECIMAL(32, 16) NOT NULL
 ) ENGINE=InnoDB;


CREATE UNIQUE INDEX PRICE_HISTORY_I01 ON PRICE_HISTORY (coin_symbol, price_date);
