/* ブロックの絵（8列×8行）。文字: o y p b g w=色 / H=かたい B=ばくだん I=？アイテム S=ほし / .=なし */
(function () {
  var KB = (window.KB = window.KB || {});
  KB.PICTURES = [
    { id: 'neko', name: 'ねこ', rows: ['.oo..oo.', 'oooooooo', 'owoooowo', 'oooSSooo', 'oHoppoHo', '.oooooo.', '..oIIo..', '...BB...'] },
    { id: 'rocket', name: 'ロケット', rows: ['...pp...', '..wwww..', '..wbbw..', '..wbbw..', '.HwwwwH.', 'HHwSSwHH', '..oIIo..', '.yoBBoy.'] },
    { id: 'sakana', name: 'さかな', rows: ['..bbbb..', '.bbbbb.g', 'bwbbbSgg', 'bbbbbbgg', 'bbHbbbgg', '.bbbbb.g', '..bbIb..', '...BB...'] },
    { id: 'hana', name: 'おはな', rows: ['..pppp..', '.pppppp.', 'ppyyyypp', 'ppySSypp', 'ppyyyypp', '.pppppp.', '...gg...', '..gIBg..'] },
    { id: 'hoshi', name: 'おほしさま', rows: ['...yy...', '...yy...', 'yyyyyyyy', '.yyyIyy.', '..yHHy..', '.yyBByy.', '.yy..yy.', '.y....y.'] }
  ];
})();
