/* rules file */

var x, y, z;

when: if (x > 5) {
    console.log("Too much!")
    x = 1
}

set: {
    x = y + z
}

set: x = y + z



var series = $CL.contract.history()