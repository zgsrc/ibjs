# Symbols

The SDK lets you specify financial instruments in a readable symbol format.

    [date]? [symbol] [side/type]? (in [currency])? (on [exchange])? (at [strike])?

So for example, a stock might look like:

* IBM
* IBM stock
* IBM stock in MXN on BMV

Futures:

* Jan16 CL futures
* Jan16 CL futures in USD on NYMEX

Options:

* Sep16'17 AAPL puts at 110

Currencies:

* USD.EUR currency

Indices:

* INDU index

> **NOTE**: This capability does not serve as a security search.  Use the [IB contract search](https://pennies.interactivebrokers.com/cstools/contract_info) for that.