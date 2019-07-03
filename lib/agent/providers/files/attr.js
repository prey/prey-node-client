var fs   = new ActiveXObject("Scripting.FileSystemObject"),
    name = WScript.Arguments.item (0);

var file, out, error;

try {
  file = fs.getFile(name);

} catch (e) {
  try  { file = fs.GetFolder(name); }
  catch(e) { error = e.message; }
}

if (error) out = 'Error: ' + error;
else {
  out  = '{';
  out += '"readonly":' + !!(file.attributes & 1)    +',';  //Read-only
  out += '"hidden":'   + !!(file.attributes & 2)    +',';  //Hidden
  out += '"system":'   + !!(file.attributes & 4)    +',';  //System
  out += '"directory":'+ !!(file.attributes & 16)   +',';  //Directory
  out += '"archive":'  + !!(file.attributes & 32)   +',';  //Archive
  out += '"symlink":'  + !!(file.attributes & 1024)     ;  // Reparse point (symbolic link)
  out += '}';
}

WScript.echo(out);