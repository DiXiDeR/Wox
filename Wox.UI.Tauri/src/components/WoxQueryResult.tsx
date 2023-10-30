import styled from "styled-components"
import { WOXMESSAGE } from "../entity/WoxMessage.typings"
import React, { useImperativeHandle, useRef, useState } from "react"
import { WoxImageTypeEnum } from "../enums/WoxImageTypeEnum.ts"
import { WoxTauriHelper } from "../utils/WoxTauriHelper.ts"
import { WoxMessageHelper } from "../utils/WoxMessageHelper.ts"
import { WoxMessageMethodEnum } from "../enums/WoxMessageMethodEnum.ts"
import { WoxMessageRequestMethod, WoxMessageRequestMethodEnum } from "../enums/WoxMessageRequestMethodEnum.ts"
import { WoxPreviewTypeEnum } from "../enums/WoxPreviewTypeEnum.ts"
import { Image } from "react-bootstrap"
import Markdown from "react-markdown"

export type WoxQueryResultRefHandler = {
  clearResultList: () => void
  changeResultList: (preview: boolean, results: WOXMESSAGE.WoxMessageResponseResult[]) => void
  moveUp: () => void
  moveDown: () => void
  doAction: () => void
}

export type WoxQueryResultProps = {
  callback?: (method: WoxMessageRequestMethod) => void
}

export default React.forwardRef((_props: WoxQueryResultProps, ref: React.Ref<WoxQueryResultRefHandler>) => {
  const currentWindowHeight = useRef(60)
  const currentResultList = useRef<WOXMESSAGE.WoxMessageResponseResult[]>([])
  const currentActiveIndex = useRef(0)
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [resultList, setResultList] = useState<WOXMESSAGE.WoxMessageResponseResult[]>([])
  const [hasPreview, setHasPreview] = useState<boolean>(false)

  const resetResultList = (rsList: WOXMESSAGE.WoxMessageResponseResult[]) => {
    currentResultList.current = [...rsList]
    setResultList(currentResultList.current)
  }

  const resizeWindowByResultList = (results: WOXMESSAGE.WoxMessageResponseResult[], windowHeight: number) => {
    if (windowHeight > currentWindowHeight.current) {
      WoxTauriHelper.getInstance().setSize(WoxTauriHelper.getInstance().getWoxWindowWidth(), windowHeight).then(_ => {
        resetResultList(results)
      })
    } else {
      resetResultList(results)
      WoxTauriHelper.getInstance().setSize(WoxTauriHelper.getInstance().getWoxWindowWidth(), windowHeight)
    }
    currentWindowHeight.current = windowHeight
  }

  const handleAction = async () => {
    const result = currentResultList.current.find((result) => result.Index === currentActiveIndex.current)
    if (result) {
      for (const action of result.Actions) {
        if (action.IsDefault) {
          await WoxMessageHelper.getInstance().sendMessage(WoxMessageMethodEnum.ACTION.code, {
            "resultId": result.Id,
            "actionId": action.Id
          })
          if (!action.PreventHideAfterAction) {
            _props.callback?.(WoxMessageRequestMethodEnum.HideApp.code)
          }
        }
      }
    }
  }

  const getCurrentPreviewData = () => {
    const result = currentResultList.current.find((result) => result.Index === currentActiveIndex.current)
    if (result) {
      return result.Preview
    }
    return { PreviewType: "", PreviewData: "", PreviewProperties: {} } as WOXMESSAGE.WoxPreview
  }

  useImperativeHandle(ref, () => ({
    clearResultList: () => {
      setActiveIndex(0)
      resizeWindowByResultList([], 60)
    },
    changeResultList: (preview: boolean, results: WOXMESSAGE.WoxMessageResponseResult[]) => {
      setHasPreview(preview)
      //reset window size
      const windowHeight = preview ? 560 : 60 + 50 * (results.length > 10 ? 10 : results.length)
      if (currentWindowHeight.current === windowHeight) {
        resetResultList(results)
      } else {
        resizeWindowByResultList(results, windowHeight)
      }
    },
    moveUp: () => {
      currentActiveIndex.current = currentActiveIndex.current <= 0 ? currentResultList.current.length - 1 : currentActiveIndex.current - 1
      setActiveIndex(currentActiveIndex.current)
    },
    moveDown: () => {
      currentActiveIndex.current = currentActiveIndex.current >= currentResultList.current.length - 1 ? 0 : currentActiveIndex.current + 1
      setActiveIndex(currentActiveIndex.current)
    },
    doAction: () => {
      handleAction()
    }
  }))

  return <Style className={"wox-results"}>
    <ul key={"wox-result-list"}>
      {resultList.map((result, index) => {
        return <li id={`wox-result-li-${index}`} key={`wox-result-li-${index}`} className={activeIndex === index ? "active" : "inactive"}>
          {result.Icon.ImageType === WoxImageTypeEnum.WoxImageTypeSvg.code &&
            <div className={"wox-query-result-image"}
                 dangerouslySetInnerHTML={{ __html: result.Icon.ImageData }}></div>}
          {result.Icon.ImageType === WoxImageTypeEnum.WoxImageTypeUrl.code &&
            <img src={result.Icon.ImageData} className={"wox-query-result-image"} alt={"query-result-image"} />}
          {result.Icon.ImageType === WoxImageTypeEnum.WoxImageTypeBase64.code &&
            <img src={result.Icon.ImageData} className={"wox-query-result-image"} alt={"query-result-image"} />}
          <h2 className={"wox-result-title"}>{result.Title}</h2>
          {result.SubTitle && <h3 className={"wox-result-subtitle"}>{result.SubTitle}</h3>}
        </li>
      })}
    </ul>
    {hasPreview && getCurrentPreviewData().PreviewProperties && Object.keys(getCurrentPreviewData().PreviewProperties)?.length > 0 &&
      <div
        className={"wox-query-result-preview"}>
        <div className={"wox-query-result-preview-content"}>
          {getCurrentPreviewData().PreviewType === WoxPreviewTypeEnum.WoxPreviewTypeText.code && <p>{getCurrentPreviewData().PreviewData}</p>}
          {getCurrentPreviewData().PreviewType === WoxPreviewTypeEnum.WoxPreviewTypeImage.code &&
            <Image src={getCurrentPreviewData().PreviewData}
                   className={"wox-query-result-preview-image"} />}
          {getCurrentPreviewData().PreviewType === WoxPreviewTypeEnum.WoxPreviewTypeImage.code &&
            <Markdown>{getCurrentPreviewData().PreviewData}</Markdown>}
        </div>

        <div className={"wox-query-result-preview-properties"}>
          {Object.keys(getCurrentPreviewData().PreviewProperties)?.map((key) => {
            return <div key={`key-${key}`}
                        className={"wox-query-result-preview-property"}>
              <div
                className={"wox-query-result-preview-property-key"}>{key}</div>
              <div
                className={"wox-query-result-preview-property-value"}>{getCurrentPreviewData().PreviewProperties[key]}</div>
            </div>
          })}
        </div>
      </div>}
  </Style>
})

const Style = styled.div`
  display: flex;
  flex-direction: row;
  overflow: hidden;
  width: 800px;

  ul {
    padding: 0;
    margin: 0;
    max-height: 500px;
    overflow: hidden;
    width: 50%;
    border-right: ${WoxTauriHelper.getInstance().isTauri() ? "0px" : "1px"} solid #dedede;;
  }

  ul:last-child {
    width: 100%;
  }

  ul + div {
    width: 50%;
  }

  ul li {
    display: block;
    height: 50px;
    line-height: 50px;
    border-bottom: 1px solid #dedede;
    cursor: pointer;
    width: 100%;
  }

  ul li .wox-query-result-image {
    text-align: center;
    line-height: 36px;
    height: 36px;
    width: 36px;
    margin: 7px;
    float: left;

    svg {
      width: 36px !important;
      height: 36px !important;
    }
  }

  ul li h2,
  ul li h3 {
    margin: 0;
    padding-left: 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 400;
    font-family: "Lucida Sans Unicode", "Lucida Grande", sans-serif;
  }

  ul li h2 {
    font-size: 20px;
    line-height: 30px;
  }

  ul li h2:last-child {
    font-size: 20px;
    line-height: 50px;
  }

  ul li h3 {
    font-size: 13px;
    line-height: 15px;
  }

  ul li.active {
    background-color: #dedede;
  }

  .wox-query-result-preview {
    position: relative;
    min-height: 490px;
    border-left: 1px solid #dedede;
    padding: 10px;

    .wox-query-result-preview-content {
      max-height: 400px;
      overflow-y: auto;

      p {
        word-wrap: break-word;
      }

      .wox-query-result-preview-image {
        width: 100%;
        max-height: 400px;
      }
    }

    .wox-query-result-preview-properties {
      position: absolute;
      left: 0;
      bottom: 0;
      right: 0;
      max-height: 90px;
      overflow-y: auto;

      .wox-query-result-preview-property {
        display: flex;
        width: 100%;
        border-top: 1px solid #dee2e6;
        padding: 2px 10px;
        overflow: hidden;

        .wox-query-result-preview-property-key {
          flex: 3;
        }

        .wox-query-result-preview-property-value {
          flex: 4;
        }

        .wox-query-result-preview-property-key, .wox-query-result-preview-property-value {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

    }
  }
`