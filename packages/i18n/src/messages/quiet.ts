import type { MessageCatalog } from '../types'

export const quietMessages = {
  'quiet.dismiss': { en: 'Dismiss', ar: 'تجاهل' },
  'quiet.secretFridayTitle': { en: 'Friday night, project done.', ar: 'ليلة جمعة، والمشروع خلص.' },
  'quiet.secretFridayBody': { en: 'The hotfix can wait until Monday. Probably.', ar: 'الهوتفكس يقدر ينتظر لين الاثنين. غالباً.' },
  'quiet.secretLateTitle': { en: 'Saved after midnight.', ar: 'انحفظ بعد منتصف الليل.' },
  'quiet.secretLateBody': { en: 'Future you will thank present you for the export backup.', ar: 'نسخة الغد راح تشكرك على نسخة التصدير.' },
  'quiet.secretSundayTitle': { en: 'Sunday, and the text is full.', ar: 'الأحد، والنص مكتمل.' },
  'quiet.secretSundayBody': { en: 'Monday can have the hotfix. You already did the quiet part.', ar: 'الاثنين يقدر ياخذ الهوتفكس. أنت خلّصت الجزء الهادئ.' },
} satisfies MessageCatalog
