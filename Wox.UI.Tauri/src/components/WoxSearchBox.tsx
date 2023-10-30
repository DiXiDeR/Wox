import {Col, FormControl, Image, InputGroup, ListGroup, Row} from "react-bootstrap"
import React, {useEffect, useRef, useState} from "react"
import {WoxMessageHelper} from "../utils/WoxMessageHelper.ts"
import styled from "styled-components"
import {WOXMESSAGE} from "../entity/WoxMessage.typings"
import {WoxMessageMethodEnum} from "../enums/WoxMessageMethodEnum.ts"
import {WoxImageTypeEnum} from "../enums/WoxImageTypeEnum.ts"
import {WoxPreviewTypeEnum} from "../enums/WoxPreviewTypeEnum.ts"
import Markdown from "react-markdown"
import {hide, show} from "@tauri-apps/api/app"
import {WoxMessageRequestMethodEnum} from "../enums/WoxMessageRequestMethodEnum.ts"
import {appWindow, LogicalPosition, LogicalSize} from "@tauri-apps/api/window"
import {WoxPositionTypeEnum} from "../enums/WoxPositionTypeEnum.ts"
import {useInterval} from "usehooks-ts"
import {WoxLogHelper} from "../utils/WoxLogHelper.ts"

const queryBoxRef = React.createRef<
    HTMLInputElement
>()
export default () => {
    const queryText = useRef<string>()
    const fullResultList = useRef<WOXMESSAGE.WoxMessageResponseResult[]>([])
    const lastResultList = useRef<WOXMESSAGE.WoxMessageResponseResult[]>([])
    const refreshTotalCount = useRef<number>(0)
    const [resultList, setResultList] = useState<WOXMESSAGE.WoxMessageResponseResult[]>([])
    const [activeIndex, setActiveIndex] = useState<number>(0)
    const currentIndex = useRef(0)
    const fixedShownItemCount = 10
    const requestTimeoutId = useRef<number>()
    const hasLatestQueryResult = useRef<boolean>(true)
    const [hasPreview, setHasPreview] = useState<boolean>(false)

    useInterval(
        () => {
            refreshTotalCount.current = refreshTotalCount.current + 100
            refreshResults()
        },
        100
    )

    const showApp = async (context: WOXMESSAGE.ShowContext) => {
        if (context.Position.Type === WoxPositionTypeEnum.WoxPositionTypeMouseScreen.code) {
            await appWindow.setPosition(new LogicalPosition(Number(context.Position.X), Number(context.Position.Y)))
        }
        if (context.SelectAll) {
            queryBoxRef.current?.select()
        }
        await appWindow.setFocus()
        await show()
    }

    const hideApp = async () => {
        await hide()
    }

    const changeQuery = async (query: string) => {
        if (queryBoxRef.current) {
            queryBoxRef.current.value = query
            onQueryChange(query)
        }
    }

    const onQueryChange = (query: string) => {
        queryText.current = query
        fullResultList.current = []
        clearTimeout(requestTimeoutId.current)
        hasLatestQueryResult.current = false
        WoxMessageHelper.getInstance().sendQueryMessage({
            query: queryText.current,
            type: "text"
        }, handleQueryCallback)
        requestTimeoutId.current = setTimeout(() => {
            if (!hasLatestQueryResult.current) {
                clearResultList()
            }
        }, 50)
    }

    const refreshResults = async () => {
        let needUpdate = false
        const currentCount = refreshTotalCount.current
        for (const [i, result] of lastResultList.current.entries()) {
            if (result.RefreshInterval > 0) {
                if (currentCount % result.RefreshInterval === 0) {
                    const refreshableResult = {
                        Title: result.Title,
                        SubTitle: result.SubTitle,
                        Icon: result.Icon,
                        Preview: result.Preview,
                        ContextData: result.ContextData,
                        RefreshInterval: result.RefreshInterval
                    } as WOXMESSAGE.WoxRefreshableResult

                    let response = await WoxMessageHelper.getInstance().sendMessage(WoxMessageMethodEnum.REFRESH.code, {
                        "resultId": result.Id,
                        "refreshableResult": JSON.stringify(refreshableResult)
                    })
                    if (response.Success) {
                        const newResult = response.Data as WOXMESSAGE.WoxRefreshableResult
                        if (newResult) {
                            lastResultList.current[i].Title = newResult.Title
                            lastResultList.current[i].SubTitle = newResult.SubTitle
                            lastResultList.current[i].Icon = newResult.Icon
                            lastResultList.current[i].Preview = newResult.Preview
                            lastResultList.current[i].ContextData = newResult.ContextData
                            lastResultList.current[i].RefreshInterval = newResult.RefreshInterval
                            needUpdate = true
                        }
                    } else {
                        WoxLogHelper.getInstance().log(`refresh [${result.Title}] failed: ${response.Data}`)
                    }
                }
            }
        }

        if (needUpdate) {
            setResultList([...lastResultList.current])
        }
    }

    /*
        Handle Global Request
     */
    const handleRequestCallback = async (message: WOXMESSAGE.WoxMessage) => {
        if (message.Method === WoxMessageRequestMethodEnum.ChangeQuery.code) {
            await changeQuery(message.Data as string)
        }
        if (message.Method === WoxMessageRequestMethodEnum.HideApp.code) {
            await hideApp()
        }
        if (message.Method === WoxMessageRequestMethodEnum.ShowApp.code) {
            await showApp(message.Data as WOXMESSAGE.ShowContext)
        }
        if (message.Method === WoxMessageRequestMethodEnum.ToggleApp.code) {
            appWindow.isVisible().then(async visible => {
                if (visible) {
                    await hideApp()
                } else {
                    await showApp(message.Data as WOXMESSAGE.ShowContext)
                }
            })
        }
    }

    /*
        Clear result list
     */
    const clearResultList = () => {
        setResultList([])
        setActiveIndex(0)
        currentIndex.current = 0
    }

    /*
        Rest result list
     */
    const resetResultListData = (rsList: WOXMESSAGE.WoxMessageResponseResult[]) => {
        lastResultList.current = [...rsList]
        setResultList(lastResultList.current)
    }

    /*
        Because the query callback will be called multiple times, so we need to filter the result by query text
     */
    const handleQueryCallback = (results: WOXMESSAGE.WoxMessageResponseResult[]) => {
        setHasPreview(false)
        fullResultList.current = fullResultList.current.concat(results.filter((result) => {
            if (result.AssociatedQuery === queryText.current) {
                hasLatestQueryResult.current = true
            }
            return result.AssociatedQuery === queryText.current
        })).map((result, index) => {
            if (result.Preview.PreviewType) {
                setHasPreview(true)
            } else {
                setHasPreview(false)
            }
            return Object.assign({...result, Index: index})
        })

        //sort fullResultList order by score desc
        fullResultList.current.sort((a, b) => {
            return b.Score - a.Score
        })
        clearResultList()
        setShownResultList()
    }

    /*
        Set the result list to be shown
     */
    const setShownResultList = () => {
        const rsList = currentIndex.current >= fixedShownItemCount ? fullResultList.current.slice(currentIndex.current - fixedShownItemCount + 1, currentIndex.current + 1) : fullResultList.current.slice(0, fixedShownItemCount)
        const windowHeight = hasPreview ? 60 + 491 : 60 + 49 * rsList.length + (rsList.length > 0 ? 1 : 0)
        if (hasPreview || lastResultList.current.length !== rsList.length) {
            appWindow.setSize(new LogicalSize(800, windowHeight)).then(_ => {
                resetResultListData(rsList)
            })
        } else {
            resetResultListData(rsList)
        }
    }

    /*
        Deal with the active index
     */
    const dealActiveIndex = (isUp: boolean) => {
        if (isUp) {
            if (currentIndex.current > 0) {
                currentIndex.current = currentIndex.current - 1
                setActiveIndex(currentIndex.current < 0 ? 0 : Math.min(currentIndex.current, fixedShownItemCount - 1))
                setShownResultList()
            }
        } else {
            if (currentIndex.current < fullResultList.current.length - 1) {
                currentIndex.current = currentIndex.current + 1
                setActiveIndex(currentIndex.current >= fixedShownItemCount ? fixedShownItemCount - 1 : currentIndex.current)
                setShownResultList()
            }
        }
    }

    const dealWithAction = async () => {
        const result = fullResultList.current.find((result) => result.Index === currentIndex.current)
        if (result) {
            for (const action of result.Actions) {
                if (action.IsDefault) {
                    await WoxMessageHelper.getInstance().sendMessage(WoxMessageMethodEnum.ACTION.code, {
                        "resultId": result.Id,
                        "actionId": action.Id
                    })
                    if (!action.PreventHideAfterAction) {
                        await hideApp()
                    }
                }
            }
        }
    }

    const getCurrentPreviewData = () => {
        const result = fullResultList.current.find((result) => result.Index === currentIndex.current)
        if (result) {
            return result.Preview
        }
        return {PreviewType: "", PreviewData: "", PreviewProperties: {}} as WOXMESSAGE.WoxPreview
    }

    useEffect(() => {
        WoxMessageHelper.getInstance().initialRequestCallback(handleRequestCallback)
        appWindow.setFocus()
    }, [])

    return <Style onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
            dealActiveIndex(true)
            event.preventDefault()
            event.stopPropagation()
        }
        if (event.key === "ArrowDown") {
            dealActiveIndex(false)
            event.preventDefault()
            event.stopPropagation()
        }
        if (event.key === "Enter") {
            dealWithAction()
            event.preventDefault()
            event.stopPropagation()
        }
        if (event.key === "Escape") {
            hideApp()
            event.preventDefault()
            event.stopPropagation()
        }
    }} onWheel={(event) => {
        if (event.deltaY > 0) {
            dealActiveIndex(false)
        }
        if (event.deltaY < 0) {
            dealActiveIndex(true)
        }
    }}>
        <InputGroup size={"lg"}>
            <FormControl
                id="Wox"
                ref={queryBoxRef}
                aria-label="Wox"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                as={"input"}
                autoFocus={true}
                onChange={(e) => {
                    onQueryChange(e.target.value)
                }}
            />
            <InputGroup.Text aria-describedby={"Wox"}
                             onMouseMoveCapture={(event) => {
                                 appWindow.startDragging()
                                 event.preventDefault()
                                 event.stopPropagation()
                             }}>Wox</InputGroup.Text>
        </InputGroup>
        {resultList?.length > 0 && <div className={"wox-query-result-container"}>
            <Row>
                <Col><ListGroup className={"wox-query-result-list"}>
                    {resultList?.map((result, index) => {
                        return <ListGroup.Item
                            key={`wox-query-result-key-${result.Id}`}
                            active={index === activeIndex}
                            onMouseMoveCapture={() => {
                                if (result.Index !== undefined && currentIndex.current !== result.Index) {
                                    currentIndex.current = result.Index
                                    setActiveIndex(index)
                                }
                            }}
                            onClick={() => {
                                dealWithAction()
                            }}>
                            <div className={"wox-query-result-item"}>
                                {result.Icon.ImageType === WoxImageTypeEnum.WoxImageTypeSvg.code &&
                                    <div className={"wox-query-result-image"}
                                         dangerouslySetInnerHTML={{__html: result.Icon.ImageData}}></div>}
                                {result.Icon.ImageType === WoxImageTypeEnum.WoxImageTypeUrl.code &&
                                    <Image src={result.Icon.ImageData} className={"wox-query-result-image"}/>}
                                {result.Icon.ImageType === WoxImageTypeEnum.WoxImageTypeBase64.code &&
                                    <Image src={result.Icon.ImageData} className={"wox-query-result-image"}/>}
                                <div className={"ms-2 me-auto wox-query-result-item-intro"}>
                                    <div className={"fw-bold result-item-title"}>{result.Title}</div>
                                    <div
                                        className={"fw-lighter result-item-sub-title"}>{result.Score} - {result.SubTitle}</div>
                                </div>
                            </div>
                        </ListGroup.Item>
                    })}
                </ListGroup></Col>
                {hasPreview && <Col>
                    {getCurrentPreviewData().PreviewProperties && Object.keys(getCurrentPreviewData().PreviewProperties)?.length > 0 &&
                        <div
                            className={"wox-query-result-preview"}>
                            <div className={"wox-query-result-preview-content"}>
                                {getCurrentPreviewData().PreviewType === WoxPreviewTypeEnum.WoxPreviewTypeText.code && getCurrentPreviewData().PreviewData}
                                {getCurrentPreviewData().PreviewType === WoxPreviewTypeEnum.WoxPreviewTypeImage.code &&
                                    <Image src={getCurrentPreviewData().PreviewData}
                                           className={"wox-query-result-preview-image"}/>}
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
                </Col>}
            </Row>
        </div>}
    </Style>
}

const Style = styled.div`
    .wox-query-result-list {
        max-height: 490px;
        overflow-y: hidden;
    }
    .wox-query-result-item {
        display: flex;
        align-items:center;
    }
    .wox-query-result-item-intro {
        width: 0;
        flex: 1;
    }
    .result-item-title, .result-item-sub-title {
        overflow: hidden !important;
        white-space: nowrap !important;
        text-overflow: ellipsis !important;
    }
    .wox-query-result-image {
        width: 36px;
        height: 36px;
        svg {
            width: 36px !important;
            height: 36px !important;
        }
    }
    .wox-query-result-container  {
        .row, .col {
            padding: 0 !important;
            margin: 0 !important;
        }
        border-bottom: 1px solid #dee2e6;
    }
    .wox-query-result-preview {
        position: relative;
        min-height: 490px;
        border: 1px solid #dee2e6;
        border-top: 0;
        border-bottom: 0;
        padding: 10px;
        .wox-query-result-preview-content {
            max-height: 400px;
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
                .wox-query-result-preview-property-key,.wox-query-result-preview-property-value {
                    flex: 1;
                }
            }
            
        }
    }
`