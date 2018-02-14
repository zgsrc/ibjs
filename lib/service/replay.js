const LineByLineReader = require('line-by-line');

function replay(file, emitter, speed, done) {
    let reader = LineByLineReader(file);
    reader.pause();
    
    let buffer = [ ];
    reader.on("error", err => {
        emitter.emit("error", err);
    }).on("line", line => {
        line = line.split("|");
        
        let time = parseInt(line[0]),
            name = line[2],
            data = JSON.parse(line.slice(3).join(''));
        
        buffer.push({ time: time, name: name, data: data });
        
        if (buffer.length > 100) {
            reader.pause();
        }
    }).on("end", () => {
        resume = false;
        
        let clear = setInterval(() => {
            if (buffer.length == 0) {
                clearInterval(loop);
                clearInterval(clear);
                if (done) done();
            }
        }, 100);
    });
    
    let delta = -1,
        resume = true;
    
    let loop = setInterval(() => {
        if (buffer.length < 100) {
            if (resume) reader.resume();
        }
        
        if (delta == -1 && buffer.length) {
            delta = (new Date()).getTime() - (buffer[0].time / (speed || 1));
        }
        
        let now = (new Date()).getTime();
        while (buffer.length && now + 10 > (buffer[0].time / (speed || 1)) + delta) {
            let event = buffer.shift();
            emitter.emit(event.name, ...event.data);
        }
    }, 50);
}

module.exports = replay;