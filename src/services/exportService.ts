import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  BorderStyle,
  VerticalAlign
} from "docx";
import { saveAs } from "file-saver";

export const exportKmzhToDocx = async (data: any) => {
  const { metadata, stages, lessonObjectives, assessmentCriteria, languageObjectives, values, crossCurricularLinks, previousLearning, differentiation, assessmentCheck, healthAndSafety, reflection, descriptorsTable } = data;

  if (!metadata || !stages) {
    console.error("Invalid KMZH data for export");
    return;
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: metadata.ministry || "Қазақстан Республикасы Оқу-ағарту министрлігі",
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: metadata.school || "Мектеп атауы",
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [
              new TextRun({
                text: "Қысқа мерзімді жоспар",
                bold: true,
                size: 28,
              }),
            ],
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createRow("Білім беру ұйымының атауы", metadata.school),
              createRow("Пәні", metadata.subject),
              createRow("Бөлім", metadata.section),
              createRow("Педагогтің аты-жөні", metadata.teacher),
              createRow("Күні", metadata.date),
              createRow("Сынып", metadata.grade),
              createRow("Қатысушылар саны", metadata.participants),
              createRow("Қатыспағандар саны", metadata.absent),
            ],
          }),

          new Paragraph({ spacing: { before: 200 } }),

          new Paragraph({
            children: [new TextRun({ text: "Тақырыбы: ", bold: true }), new TextRun(metadata.topic || "")],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Оқу бағдарламасына сәйкес оқыту мақсаты: ", bold: true }), new TextRun(metadata.learningObjective || "")],
          }),

          // Lesson Objectives
          new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Сабақтың мақсаты: ", bold: true })] }),
          ...(lessonObjectives || []).map((obj: string) => new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun(obj)],
          })),

          // Assessment Criteria
          new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Бағалау критерийлері: ", bold: true })] }),
          ...(assessmentCriteria || []).map((crit: string) => new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun(crit)],
          })),

          // Language Objectives
          new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: "Тілдік мақсаттар: ", bold: true })] }),
          new Paragraph({
            children: [
              new TextRun({ text: "Лексика және терминология: ", italics: true }),
              new TextRun((languageObjectives?.vocabulary || []).join(", ")),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Диалог пен жазу үшін пайдалы сөз тіркестері: ", italics: true }),
              new TextRun((languageObjectives?.phrases || []).join("; ")),
            ],
          }),

          new Paragraph({
            children: [new TextRun({ text: "Құндылықтарды дарыту: ", bold: true }), new TextRun(values || metadata.value || "")],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Пәнаралық байланыс: ", bold: true }), new TextRun(crossCurricularLinks || "")],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Алдыңғы білім: ", bold: true }), new TextRun(previousLearning || "")],
          }),

          new Paragraph({ spacing: { before: 400, after: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "САБАҚТЫҢ БАРЫСЫ", bold: true, size: 24 })] }),

          // Lesson Flow Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell("Сабақтың жоспарланған кезеңдері"),
                  createHeaderCell("Педагогтің әрекеті"),
                  createHeaderCell("Оқушының әрекеті"),
                  createHeaderCell("Бағалау"),
                  createHeaderCell("Ресурстар"),
                ],
              }),
              ...(stages || []).map((stage: any) => new TableRow({
                children: [
                  createCell(stage.period),
                  createCell(stage.teacherAction),
                  createCell(stage.studentAction),
                  createCell(stage.assessment),
                  createCell(stage.resources),
                ],
              })),
            ],
          }),

          new Paragraph({ spacing: { before: 200 } }),

          // Descriptors Table (if exists)
          ...(descriptorsTable && descriptorsTable.length > 0 ? [
            new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: "Балл қою кестесі:", bold: true })] }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    createHeaderCell("Тапсырма атауы"),
                    createHeaderCell("Дескриптор"),
                    createHeaderCell("Балл"),
                  ],
                }),
                ...descriptorsTable.map((d: any) => new TableRow({
                  children: [
                    createCell(d.taskName),
                    createCell(d.descriptor),
                    createCell(d.points?.toString()),
                  ],
                })),
              ],
            })
          ] : []),

          new Paragraph({ spacing: { before: 200 } }),
          new Paragraph({
            children: [new TextRun({ text: "Саралау: ", bold: true }), new TextRun(differentiation || "")],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Бағалау: ", bold: true }), new TextRun(assessmentCheck || "")],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Денсаулық және қауіпсіздік техникасын сақтау: ", bold: true }), new TextRun(healthAndSafety || "")],
          }),
          new Paragraph({
            children: [new TextRun({ text: "Рефлексия: ", bold: true }), new TextRun(reflection || "")],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `KMZH_${(metadata.topic || "lesson").replace(/\s+/g, "_")}.docx`;
  saveAs(blob, fileName);
};

export const exportAssessmentToDocx = async (data: any) => {
  const { metadata, tasks, answerKey } = data;

  if (!metadata || !tasks) {
    console.error("Invalid Assessment data for export");
    return;
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${metadata.type} - ${metadata.subject} (${metadata.grade}-сынып)`,
                bold: true,
                size: 28,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `Тақырыбы: ${metadata.topic}`,
                bold: true,
                size: 24,
              }),
            ],
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "Жалпы балл: ", bold: true }),
              new TextRun(metadata.totalPoints?.toString() || "0"),
            ],
          }),

          new Paragraph({ spacing: { before: 400, after: 200 }, children: [new TextRun({ text: "ТАПСЫРМАЛАР", bold: true, size: 24 })] }),

          // Tasks
          ...tasks.flatMap((task: any, i: number) => [
            new Paragraph({
              spacing: { before: 200 },
              children: [
                new TextRun({ text: `Тапсырма №${task.number || i + 1}`, bold: true }),
                new TextRun({ text: ` [${task.maxPoint} балл]`, italics: true, color: "666666" }),
              ],
            }),
            new Paragraph({
              children: [new TextRun({ text: task.task, italics: true })],
            }),
            // Options for choice tasks
            ...(task.type === 'choice' && task.options ? 
              task.options.map((opt: string, idx: number) => new Paragraph({
                indent: { left: 720 },
                children: [new TextRun(`${String.fromCharCode(65 + idx)}) ${opt}`)],
              })) : []
            ),
            // Matching
            ...(task.type === 'matching' && task.matchingPairs ? [
              new Paragraph({ text: "Сәйкестендіріңіз:" }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: task.matchingPairs.map((p: any, idx: number) => new TableRow({
                  children: [
                    createCell(`${idx + 1}. ${p.left}`),
                    createCell(`${String.fromCharCode(65 + idx)}. ${p.right}`),
                  ],
                })),
              })
            ] : []),
            new Paragraph({
              spacing: { before: 100 },
              children: [
                new TextRun({ text: "Бағалау критерийі: ", bold: true, size: 18 }),
                new TextRun({ text: task.criteria || "", size: 18 }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Ойлау дағдыларының деңгейі: ", bold: true, size: 18 }),
                new TextRun({ text: task.level || "", size: 18 }),
              ],
            }),
          ]),

          new Paragraph({ spacing: { before: 400, after: 200 }, children: [new TextRun({ text: "БАЛЛ ҚОЮ КЕСТЕСІ", bold: true, size: 24 })] }),

          // Assessment Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell("Тапсырма №"),
                  createHeaderCell("Бағалау критерийі"),
                  createHeaderCell("Дескриптор"),
                  createHeaderCell("Балл"),
                ],
              }),
              ...tasks.flatMap((task: any) => 
                task.descriptors.map((desc: any, idx: number) => new TableRow({
                  children: [
                    idx === 0 ? createCell(task.number.toString()) : createCell(""),
                    idx === 0 ? createCell(task.criteria) : createCell(""),
                    createCell(desc.description),
                    createCell(desc.point.toString()),
                  ],
                }))
              ),
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 3,
                    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Жалпы балл:", bold: true })] })],
                  }),
                  createCell(metadata.totalPoints?.toString() || "0"),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 400, after: 200 }, children: [new TextRun({ text: "ЖАУАПТАР КІЛТІ", bold: true, size: 24 })] }),

          // Answer Key
          ...(answerKey || []).map((ans: any) => new Paragraph({
            children: [
              new TextRun({ text: `№${ans.taskNumber}: `, bold: true }),
              new TextRun(ans.answer),
            ],
          })),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${metadata.type}_${(metadata.topic || "assessment").replace(/\s+/g, "_")}.docx`;
  saveAs(blob, fileName);
};

function createRow(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 40, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
      }),
      new TableCell({
        width: { size: 60, type: WidthType.PERCENTAGE },
        children: [new Paragraph(value || "")],
      }),
    ],
  });
}

function createHeaderCell(text: string) {
  return new TableCell({
    shading: { fill: "F2F2F2" },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true })] })],
    verticalAlign: VerticalAlign.CENTER,
  });
}

function createCell(text: string) {
  return new TableCell({
    children: [new Paragraph(text || "")],
    verticalAlign: VerticalAlign.CENTER,
  });
}
