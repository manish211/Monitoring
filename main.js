var sio = require('socket.io')
  , http = require('http')
  , request = require('request')
  , os = require('os')
  , nodemailer = require('nodemailer')
  , secret = require('../../secret/secret.json')
  ;


var transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  secureConnection: false,
  port: 587,
  domains: ["gmail.com", "googlemail.com"],
  auth: {
      user: 'pdeng@ncsu.edu',
      pass: secret.pass
  }
});


function send_mail(subjectText, detailsText){

	var mailOptions =
	{
	  from: 'Pei Deng <pdeng@ncsu.edu>',
	  to: 'Pei Deng <pdeng@ncsu.edu>',
	  bcc: '',
	  subject: 'SYSTEM ALERT: '+subjectText,
	  text: detailsText 
	};


	transporter.sendMail(mailOptions, function(error, info){
  	  if(error){
    	console.log(error);
  	  }else{
    	console.log('Message sent: ' + info.response);
  	  }
    });
}

var app = http.createServer(function (req, res) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      // res.write("HELLO")
      res.end();
    })
  , io = sio.listen(app);



function loadAvgPercent()
{
	var loadAvgArray = os.loadavg()

	var percentLoadAvgArray = [0,0,0]

	var numOfLogicalCpus = os.cpus().length

	percentLoadAvgArray[0] = loadAvgArray[0]/numOfLogicalCpus 
	percentLoadAvgArray[1] = loadAvgArray[1]/numOfLogicalCpus 
	percentLoadAvgArray[2] = loadAvgArray[2]/numOfLogicalCpus 

	return percentLoadAvgArray;
}

function memoryLoad()
{
	console.log( os.totalmem(), os.freemem() );
	var os_total_mem=os.totalmem()
	var os_free_mem = os.freemem()
	var os_mem_used = os_total_mem - os_free_mem
	var percent_mem_used = (os_mem_used*100)/os_total_mem
	console.log("os_mem_used=", os_mem_used)
	console.log("percent_mem_used=", percent_mem_used)
	// return 100;
	return percent_mem_used;
	// return 0;
}

// Create function to get CPU information
function cpuTicksAcrossCores() 
{
  //Initialise sum of idle and time of cores and fetch CPU info
  var totalIdle = 0, totalTick = 0;
  var cpus = os.cpus();
  console.log("CPU LENGTH:"+cpus.length)
 
  //Loop through CPU cores
  for(var i = 0, len = cpus.length; i < len; i++) 
  {

  	console.log("LOOP THROUGH CPU CORES")
		//Select CPU core
		var cpu = cpus[i];
		//Total up the time in the cores tick
		for(type in cpu.times) 
		{
			totalTick += cpu.times[type];
		}     
		//Total up the idle time of the core
		totalIdle += cpu.times.idle;
  }
 
  //Return the average Idle and Tick times
  return {idle: totalIdle / cpus.length,  total: totalTick / cpus.length};
}

var startMeasure = cpuTicksAcrossCores();

function cpuAverage()
{
	var endMeasure = cpuTicksAcrossCores(); 
 
	//Calculate the difference in idle and total time between the measures
	var idleDifference = endMeasure.idle - startMeasure.idle;
	var totalDifference = endMeasure.total - startMeasure.total;

	var usage = totalDifference - idleDifference
	var usagePercentage = (usage*100)/totalDifference
 
	//Calculate the average percentage CPU usage
	return usagePercentage;
}

function measureLatenancy(server)
{
	var start = Date.now()
	var options = 
	{
		url: 'http://localhost' + ":" + server.address().port,
	};
	request(options, function (error, res, body) 
	{
		server.latency = Date.now() - start ;  // From professor
	});

	return server.latency;
}

function calcuateColor()
{
	// latency scores of all nodes, mapped to colors.
	var nodes = nodeServers.map( measureLatenancy ).map( function(latency) 
	{
		var color = "#cccccc";
		if( !latency )
			return {color: color};
		if( latency > 8000 )
		{
			color = "#ff0000";
		}
		else if( latency > 4000 )
		{
			color = "#cc0000";
		}
		else if( latency > 2000 )
		{
			color = "#ffff00";
		}
		else if( latency > 1000 )
		{
			color = "#cccc00";
		}
		else if( latency > 100 )
		{
			color = "#0000cc";
		}
		else
		{
			color = "#00ff00";
		}
		//console.log( latency );
		return {color: color};
	});
	//console.log( nodes );
	return nodes;
}


/// CHILDREN nodes
var nodeServers = [];

///////////////
//// Broadcast heartbeat over websockets
//////////////


var isMailSent = false

getMaxFromArray = function( array ){
    return Math.max.apply( Math, array );
};

setInterval( function () 
{

	console.log("INSIDE INTERVAL")
	var cpuAverageVal = cpuAverage()
	var memoryLoadVal = memoryLoad()
	var percentLoadAvgArray = loadAvgPercent()
	var maxLoadAvg = getMaxFromArray(percentLoadAvgArray)*100



	io.sockets.emit('heartbeat', 
	{ 
        name: "Your Computer", cpu: cpuAverageVal, memoryLoad: memoryLoadVal, cpuMaxLoad: maxLoadAvg,
        nodes: calcuateColor()
   });

	console.log("==========================")
	console.log("cpuAverageVal:"+cpuAverageVal)
	console.log("memoryLoadVal:"+memoryLoadVal)
	console.log("maxLoadAvg:"+maxLoadAvg)
	console.log("==========================")


	if ( cpuAverageVal > 25){

		var subjectText = "CPU Threshold Breached. Please check the running processes."
		var detailsText = "\n================================\n ***ALERT SUMMARY**\n================================\n CPU USAGE: "
		detailsText =  detailsText + cpuAverageVal +"\n MEMORY USAGE: "+ memoryLoadVal + "\n MAX LOAD AVG: "
		detailsText =  detailsText + maxLoadAvg + "\n================================\n ***NOTE :Will stop monitoring now.\n Fix the problem and restart the monitoring program***\n================================\n"
		// console.log(detailsText)

		if(isMailSent === false ){
			send_mail(subjectText, detailsText)
			isMailSent = true
		}

		
		
	}
	
	if ( memoryLoadVal === 100 ){
		var subjectText = "MEMORY Threshold Breached. Please check the running processes."

		var detailsText = "\n================================\n ***ALERT SUMMARY**\n================================\n CPU USAGE: "
		detailsText =  detailsText + cpuAverageVal +"\n MEMORY USAGE: "+ memoryLoadVal + "\n MAX LOAD AVG: "
		detailsText =  detailsText + maxLoadAvg + "\n================================\n ***NOTE :Will stop monitoring now.\n Fix the problem and restart the monitoring program***\n================================\n"
		
		if(isMailSent === false ){
			send_mail(subjectText, detailsText)
			isMailSent = true
		}

	}

}, 2000);

app.listen(3000);

/// NODE SERVERS

createServer(9000, function()
{
	// FAST
});
createServer(9001, function()
{
	// MED
	for( var i =0 ; i < 300; i++ )
	{
		i/2;
	}
});
createServer(9002, function()
{
	// SLOW	
	for( var i =0 ; i < 2000000000; i++ )
	{
		Math.sin(i) * Math.cos(i);
	}	
});

function createServer(port, fn)
{
	// Response to http requests.
	var server = http.createServer(function (req, res) {
      res.writeHead(200, { 'Content-Type': 'text/html' });

      fn();
      // res.write("hello")

      res.end();
   }).listen(port);
	nodeServers.push( server );

	server.latency = undefined;
}

