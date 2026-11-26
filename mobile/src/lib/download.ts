import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ApiError, apiUrl, authHeader, renewSession } from '@/lib/api';

/**
 * Baixa um arquivo da conta (ex.: a cópia dos dados em PDF) e entrega à pessoa: download no navegador; no
 * celular, a folha de compartilhar (Arquivos, Drive, e-mail, imprimir). Renova a sessão uma vez se o token venceu.
 */
export async function downloadAndShare(path: string, filename: string, mimeType: string, uti: string) {
  if (Platform.OS === 'web') {
    await saveInBrowser(path, filename);
    return;
  }
  const target = new File(Paths.cache, filename);
  const attempt = () => File.downloadFileAsync(apiUrl(path), target, { headers: authHeader(), idempotent: true });
  let file: File;
  try {
    file = await attempt();
  } catch (error) {
    // Com status não 2xx o download falha com UnableToDownload e o código na mensagem.
    if (!String(error).includes('401') || !(await renewSession())) throw asApiError(error);
    file = await attempt().catch((retry: unknown) => {
      throw asApiError(retry);
    });
  }
  if (!(await Sharing.isAvailableAsync())) throw new ApiError(0, { detail: 'Este aparelho não permite compartilhar arquivos.' });
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: 'Meus dados no STEM Project' });
}

async function saveInBrowser(path: string, filename: string) {
  const send = () => fetch(apiUrl(path), { headers: authHeader() });
  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && (await renewSession())) res = await send();
  } catch {
    throw new ApiError(0, { detail: 'Sem conexão com o servidor. Verifique a internet e tente novamente.' });
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function asApiError(error: unknown) {
  const offline = !/\b\d{3}\b/.test(String(error));
  return new ApiError(0, {
    detail: offline
      ? 'Sem conexão com o servidor. Verifique a internet e tente novamente.'
      : 'Não foi possível gerar a cópia agora. Tente novamente.',
  });
}
