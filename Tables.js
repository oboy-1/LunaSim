// This is all for official Datatables
/*
var data = [
    [
        "Tiger Nixon",
        "System Architect",
        "Edinburgh",
        "5421",
        "2011/04/25",
        "$3,120"
    ],
    [
        "Garrett Winters",
        "Director",
        "Edinburgh",
        "8422",
        "2011/07/25",
        "$5,300"
    ]
]
//let table = new DataTable('#example');
//Either this:
$('#example').DataTable( {
    data: data
    "autoWidth": true
} );
//Or this:
let table = new DataTable('#example', {
    // options
    data: data
    "autoWidth": true
});

*/

//This is all for Vanilla Datatables
var myTable = document.querySelector("#example");
var dataTable = new DataTable(myTable);
