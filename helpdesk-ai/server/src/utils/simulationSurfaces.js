const WINDOWS_SURFACES=new Set(['windows-terminal','windows-os']);
function supportsWindowsSimulation(definition){
 const surface=String(definition?.surface||definition?.terminalType||'windows-terminal').trim().toLowerCase();
 return WINDOWS_SURFACES.has(surface);
}
// MAC address is a Windows networking term, not a request for Apple's OS.
const UNSUPPORTED_OS_PATTERN=/\b(?:macos|mac\s+os|macintosh|macbook|imac|os\s+x|linux|ubuntu|debian|fedora|redhat|centos|android|ios|iphone|ipad|chromebook)\b|\bmac\b(?!\s+(?:address(?:es)?|filter(?:ing)?|tables?|spoof(?:ing)?|learning)\b)/i;
module.exports={WINDOWS_SURFACES,supportsWindowsSimulation,UNSUPPORTED_OS_PATTERN};
