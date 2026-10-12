import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

export async function POST() {
  try {
    // Open native Windows FolderBrowserDialog via PowerShell
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms;
      $dummy = New-Object System.Windows.Forms.Form;
      $dummy.TopMost = $true;
      $dialog = New-Object System.Windows.Forms.FolderBrowserDialog;
      $dialog.Description = 'Select local folder where pasted images and files will be copied';
      $dialog.ShowNewFolderButton = $true;
      $result = $dialog.ShowDialog($dummy);
      if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $dialog.SelectedPath;
      }
    `;

    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-STA',
      '-Command',
      psScript,
    ]);

    const selectedPath = stdout.trim();
    if (!selectedPath) {
      return NextResponse.json({ cancelled: true });
    }

    return NextResponse.json({
      cancelled: false,
      folderPath: selectedPath,
    });
  } catch (error) {
    console.error('Failed to open native folder picker:', error);
    return NextResponse.json(
      {
        error: 'Could not open native folder dialog',
        defaultFolder: path.join(process.cwd(), 'local-media'),
      },
      { status: 500 }
    );
  }
}
