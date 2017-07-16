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

* Sep'17 AAPL puts at 110

Indices:

* INDU index

Currencies:

* EUR currency in USD
* EUR.USD currency
* EUR,USD currency
* EUR/USD currency
* EUR*USD currency

## Date

Dates must be in the format of a three letter month abbreviation, and then either a 2 or 4 digit year component.  The year component may be separated by a dash (-), slash (/), or apostrophe (').  If the date component is omitted, the current year is used.

For example:

    Jan
    Jun18
    Sep'2018

Alternatively, the "Front" syntax can be used to reference the front contract.  This format is composed of the word "Front", followed by a cutoff day of month (i.e. the last safe day to trade before rolling over to the next contract), and an optional month offset.  If the cutoff day is omitted, it is assumed to be 15.

For example:

    Front
    Front+1
    Front20
    Front15+1
    Front20+5

## Symbol

Symbols should be the common symbol for the contract.  You can use the [IB contract search](https://pennies.interactivebrokers.com/cstools/contract_info) to find this.

## Type

Type must be either a security type, or in the case of options, a side.