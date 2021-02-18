import _ from "lodash";


const arrayOne = [
    { baseAsset: "BTC" },
    { baseAsset: "ETH" },
    { baseAsset: "ADA" },
    { baseAsset: "RPX" },
    { baseAsset: "NEW COIN XPOF" },
    { baseAsset: "NEW COIN2 HPARF" },
];

const arrayTwo = [
    { baseAsset: "BTC" },
    { baseAsset: "ETH" },
    { baseAsset: "ADA" },
    { baseAsset: "RPX" },
];


try {
    const myDifferences = _.differenceBy(arrayOne, arrayTwo, 'baseAsset')

    const diffs = myDifferences.map((each) => {
        return each.baseAsset
    }).toString();

    console.log(diffs);

} catch (e) {
    console.log(e)
}

// will print a string with the name of the new coins